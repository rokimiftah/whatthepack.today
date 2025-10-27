// convex/orders.ts - Order Management

import type { Id } from "./_generated/dataModel";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getUserRoles, requireRole } from "./auth";
import { requireOrgAccess } from "./security";

// Create order (admin or owner)
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    recipientName: v.string(),
    recipientPhone: v.string(),
    recipientAddress: v.string(),
    recipientCity: v.string(),
    recipientProvince: v.string(),
    recipientPostalCode: v.string(),
    recipientCountry: v.string(),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
    rawChatLog: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"orders">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    // Ensure we have a Convex user record for auditing
    const userId = (await ctx.runMutation(internal.users.ensureAuth0UserRecord, {
      auth0Id: identity.subject,
    })) as Id<"users">;

    // Fetch product details and calculate totals
    let totalCost = 0;
    let totalPrice = 0;
    const orderItems = [];

    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      // Verify product belongs to same org
      if (product.orgId !== args.orgId) {
        throw new Error("Product does not belong to this organization");
      }

      // Check stock availability
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`);
      }

      const itemCost = product.costOfGoods * item.quantity;
      const itemPrice = product.sellPrice * item.quantity;

      totalCost += itemCost;
      totalPrice += itemPrice;

      orderItems.push({
        productId: item.productId,
        sku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.sellPrice,
        unitCost: product.costOfGoods,
      });

      // Reserve stock (reduce quantity)
      await ctx.db.patch(item.productId, {
        stockQuantity: product.stockQuantity - item.quantity,
        updatedAt: Date.now(),
      });

      // Log stock movement
      await ctx.db.insert("movements", {
        orgId: args.orgId,
        productId: item.productId,
        sku: product.sku,
        type: "order_created",
        quantityBefore: product.stockQuantity,
        quantityChange: -item.quantity,
        quantityAfter: product.stockQuantity - item.quantity,
        userId,
        createdAt: Date.now(),
      });
    }

    // Generate order number
    const orderCount = await ctx.db
      .query("orders")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const orderNumber = `ORD-${String(orderCount.length + 1).padStart(5, "0")}`;

    const orderId = await ctx.db.insert("orders", {
      orgId: args.orgId,
      orderNumber,
      status: "pending",
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      recipientName: args.recipientName,
      recipientPhone: args.recipientPhone,
      recipientAddress: args.recipientAddress,
      recipientCity: args.recipientCity,
      recipientProvince: args.recipientProvince,
      recipientPostalCode: args.recipientPostalCode,
      recipientCountry: args.recipientCountry,
      items: orderItems,
      totalCost,
      totalPrice,
      totalProfit: totalPrice - totalCost,
      rawChatLog: args.rawChatLog,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
    });

    return orderId;
  },
});

// Update order status
export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // SECURITY: Validate user has access to this order's organization
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["owner", "admin"]);

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "paid") {
      updates.paidAt = Date.now();
    } else if (args.status === "shipped") {
      updates.shippedAt = Date.now();
    } else if (args.status === "delivered") {
      updates.deliveredAt = Date.now();
    }

    await ctx.db.patch(args.orderId, updates);
  },
});

// Update shipping info (set by packer or shipping agent)
export const updateShipping = mutation({
  args: {
    orderId: v.id("orders"),
    weight: v.optional(v.number()),
    trackingNumber: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    shippingCost: v.optional(v.number()),
    courierService: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // SECURITY: Validate user has access to this order's organization
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["owner", "admin", "packer"]);

    const updates: any = { updatedAt: Date.now() };

    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.trackingNumber !== undefined) updates.trackingNumber = args.trackingNumber;
    if (args.labelUrl !== undefined) updates.labelUrl = args.labelUrl;
    if (args.shippingCost !== undefined) updates.shippingCost = args.shippingCost;
    if (args.courierService !== undefined) updates.courierService = args.courierService;

    // If tracking number is set, mark as shipped
    if (args.trackingNumber && order.status === "processing") {
      updates.status = "shipped";
      updates.shippedAt = Date.now();
    }

    await ctx.db.patch(args.orderId, updates);
  },
});

// Mark order as packed (by packer)
export const markPacked = mutation({
  args: {
    orderId: v.id("orders"),
    weight: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // SECURITY: Validate user has access to this order's organization
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["packer"]);

    await ctx.db.patch(args.orderId, {
      status: "processing",
      weight: args.weight,
      packedBy: identity.subject as any,
      updatedAt: Date.now(),
    });
  },
});

// List orders (role-aware)
export const list = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("processing"),
        v.literal("shipped"),
        v.literal("delivered"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);

    let orders: any[];

    if (args.status !== undefined) {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_org_status", (q) => q.eq("orgId", args.orgId).eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .order("desc")
        .collect();
    }

    const roles = await getUserRoles(ctx);
    const role = roles[0] || "unknown";

    // Packer only sees paid orders (packing queue)
    if (role === "packer") {
      return orders
        .filter((o) => o.status === "paid" || o.status === "processing")
        .map((o) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          status: o.status,
          recipientName: o.recipientName,
          recipientCity: o.recipientCity,
          items: o.items.map((i: any) => ({
            sku: i.sku,
            productName: i.productName,
            quantity: i.quantity,
          })),
          weight: o.weight,
          createdAt: o.createdAt,
        }));
    }

    // Admin sees everything except profit
    if (role === "admin") {
      return orders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        recipientName: o.recipientName,
        recipientAddress: o.recipientAddress,
        recipientCity: o.recipientCity,
        recipientProvince: o.recipientProvince,
        recipientPostalCode: o.recipientPostalCode,
        items: o.items.map((i: any) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        totalPrice: o.totalPrice,
        trackingNumber: o.trackingNumber,
        shippingCost: o.shippingCost,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        shippedAt: o.shippedAt,
      }));
    }

    // Owner sees everything
    return orders;
  },
});

// Get single order (role-aware)
export const get = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // SECURITY: Validate user has access to this order's organization
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["owner", "admin", "packer"]);

    const roles = await getUserRoles(ctx);
    const role = roles[0] || "unknown";

    if (role === "packer") {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        recipientName: order.recipientName,
        recipientCity: order.recipientCity,
        items: order.items.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
        })),
        weight: order.weight,
        createdAt: order.createdAt,
      };
    }

    if (role === "admin") {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        recipientName: order.recipientName,
        recipientAddress: order.recipientAddress,
        recipientCity: order.recipientCity,
        recipientProvince: order.recipientProvince,
        recipientPostalCode: order.recipientPostalCode,
        items: order.items.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        totalPrice: order.totalPrice,
        trackingNumber: order.trackingNumber,
        shippingCost: order.shippingCost,
        notes: order.notes,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
      };
    }

    return order;
  },
});

// Get next order for packing (packer only)
export const getNextOrder = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["packer"]);

    const nextOrder = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) => q.eq("orgId", args.orgId).eq("status", "paid"))
      .order("asc")
      .first();

    if (!nextOrder) return null;

    return {
      _id: nextOrder._id,
      orderNumber: nextOrder.orderNumber,
      recipientAddress: nextOrder.recipientAddress,
      recipientName: nextOrder.recipientName,
      recipientCity: nextOrder.recipientCity,
      specialInstructions: nextOrder.specialInstructions,
      items: nextOrder.items.map((i) => ({
        sku: i.sku,
        productName: i.productName,
        quantity: i.quantity,
      })),
    };
  },
});

// Get orders in a date range (owner/admin)
export const getByDateRange = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), args.startDate))
      .filter((q) => q.lte(q.field("createdAt"), args.endDate))
      .collect();

    return orders;
  },
});

// Get orders containing a specific product (owner/admin)
export const getByProduct = query({
  args: {
    orgId: v.id("organizations"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    return orders.filter((o) => o.items.some((i) => i.productId === args.productId));
  },
});

// Get orders packed by a specific user in a date range (owner/admin)
export const getByPacker = query({
  args: {
    orgId: v.id("organizations"),
    packerId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), args.startDate))
      .filter((q) => q.lte(q.field("createdAt"), args.endDate))
      .collect();

    return orders.filter((o) => o.packedBy === args.packerId);
  },
});

// Get orders created by a specific user in a date range (owner/admin)
export const getByCreator = query({
  args: {
    orgId: v.id("organizations"),
    creatorId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), args.startDate))
      .filter((q) => q.lte(q.field("createdAt"), args.endDate))
      .collect();

    return orders.filter((o) => o.createdBy === args.creatorId);
  },
});

// Cancel order (owner or admin)
export const cancel = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // SECURITY: Validate user has access to this order's organization
    await requireOrgAccess(ctx, order.orgId);
    await requireRole(ctx, order.orgId, ["owner", "admin"]);

    if (order.status === "shipped" || order.status === "delivered") {
      throw new Error("Cannot cancel shipped or delivered orders");
    }

    // Restore stock for all items
    for (const item of order.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(item.productId, {
          stockQuantity: product.stockQuantity + item.quantity,
          updatedAt: Date.now(),
        });

        // Log movement
        await ctx.db.insert("movements", {
          orgId: order.orgId,
          productId: item.productId,
          sku: item.sku,
          type: "order_cancelled",
          quantityBefore: product.stockQuantity,
          quantityChange: item.quantity,
          quantityAfter: product.stockQuantity + item.quantity,
          userId: identity.subject as any,
          createdAt: Date.now(),
          orderId: args.orderId,
          notes: args.reason,
        });
      }
    }

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      updatedAt: Date.now(),
      notes: args.reason ? `${order.notes ?? ""}\nCancellation reason: ${args.reason}` : order.notes,
    });
  },
});
