// convex/inventory.ts - Product/Inventory Management

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserRoles, requireRole } from "./auth";
import { requireOrgAccess } from "./security";

// Create product (owner only)
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    sku: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    costOfGoods: v.number(),
    sellPrice: v.number(),
    stockQuantity: v.number(),
    warehouseLocation: v.string(),
    sop_packing: v.optional(v.string()),
    weight: v.optional(v.number()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"products">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await requireRole(ctx, args.orgId, ["owner"]);

    // Check if SKU already exists in this org
    const existing = await ctx.db
      .query("products")
      .withIndex("by_org_sku", (q) => q.eq("orgId", args.orgId).eq("sku", args.sku))
      .first();

    if (existing) {
      throw new Error(`Product with SKU "${args.sku}" already exists`);
    }

    const createdBy = (await ctx.runMutation(internal.users.ensureAuth0UserRecord, {
      auth0Id: identity.subject,
    })) as Id<"users">;

    return await insertProduct(ctx, {
      orgId: args.orgId,
      sku: args.sku,
      name: args.name,
      description: args.description,
      costOfGoods: args.costOfGoods,
      sellPrice: args.sellPrice,
      stockQuantity: args.stockQuantity,
      warehouseLocation: args.warehouseLocation,
      sop_packing: args.sop_packing,
      weight: args.weight,
      length: args.length,
      width: args.width,
      height: args.height,
      createdBy,
    });
  },
});

// List products (role-aware filtering)
export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);

    const products = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Filter based on role
    const roles = await getUserRoles(ctx);
    const role = roles[0] || "unknown";

    if (role === "packer") {
      // Packer can only see: SKU, name, location, SOP, stock (no pricing)
      return products.map((p) => ({
        _id: p._id,
        sku: p.sku,
        name: p.name,
        stockQuantity: p.stockQuantity,
        warehouseLocation: p.warehouseLocation,
        sop_packing: p.sop_packing,
        weight: p.weight,
      }));
    }

    if (role === "admin") {
      // Admin sees everything except COGS and profit
      return products.map((p) => ({
        _id: p._id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        sellPrice: p.sellPrice,
        stockQuantity: p.stockQuantity,
        warehouseLocation: p.warehouseLocation,
        weight: p.weight,
        length: p.length,
        width: p.width,
        height: p.height,
      }));
    }

    // Owner sees everything
    return products;
  },
});

// Internal: List basic product fields for an org (no pricing), used by server-side agents for matching
export const listBasicForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    return products.map((p) => ({ sku: p.sku, name: p.name }));
  },
});

// Get product by ID (role-aware)
export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await requireRole(ctx, product.orgId, ["owner", "admin", "packer"]);

    const roles = await getUserRoles(ctx);
    const role = roles[0] || "unknown";

    if (role === "packer") {
      return {
        _id: product._id,
        sku: product.sku,
        name: product.name,
        stockQuantity: product.stockQuantity,
        warehouseLocation: product.warehouseLocation,
        sop_packing: product.sop_packing,
        weight: product.weight,
      };
    }

    if (role === "admin") {
      return {
        _id: product._id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        sellPrice: product.sellPrice,
        stockQuantity: product.stockQuantity,
        warehouseLocation: product.warehouseLocation,
        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,
      };
    }

    return product;
  },
});

// Update product (owner only)
export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    costOfGoods: v.optional(v.number()),
    sellPrice: v.optional(v.number()),
    stockQuantity: v.optional(v.number()),
    warehouseLocation: v.optional(v.string()),
    sop_packing: v.optional(v.string()),
    weight: v.optional(v.number()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await requireRole(ctx, product.orgId, ["owner"]);

    const updates: any = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.costOfGoods !== undefined) updates.costOfGoods = args.costOfGoods;
    if (args.sellPrice !== undefined) updates.sellPrice = args.sellPrice;
    if (args.stockQuantity !== undefined) updates.stockQuantity = args.stockQuantity;
    if (args.warehouseLocation !== undefined) updates.warehouseLocation = args.warehouseLocation;
    if (args.sop_packing !== undefined) updates.sop_packing = args.sop_packing;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.length !== undefined) updates.length = args.length;
    if (args.width !== undefined) updates.width = args.width;
    if (args.height !== undefined) updates.height = args.height;

    // Recalculate profit margin if pricing changed
    if (args.costOfGoods !== undefined || args.sellPrice !== undefined) {
      const cost = args.costOfGoods ?? product.costOfGoods;
      const price = args.sellPrice ?? product.sellPrice;
      updates.profitMargin = price - cost;
    }

    await ctx.db.patch(args.productId, updates);
  },
});

// Delete product (owner only)
export const remove = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await requireRole(ctx, product.orgId, ["owner"]);

    // NOTE: Hard delete. Historical orders retain snapshot fields (sku/name/prices) in order items.
    await ctx.db.delete(args.productId);
  },
});

// Adjust stock (owner only)
export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    adjustment: v.number(), // Positive or negative
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await requireRole(ctx, product.orgId, ["owner"]);

    const newQuantity = product.stockQuantity + args.adjustment;
    if (newQuantity < 0) {
      throw new Error("Cannot reduce stock below zero");
    }

    const userId = (await ctx.runMutation(internal.users.ensureAuth0UserRecord, {
      auth0Id: identity.subject,
    })) as Id<"users">;

    // Update stock
    await ctx.db.patch(args.productId, {
      stockQuantity: newQuantity,
      updatedAt: Date.now(),
    });

    // Log movement
    await ctx.db.insert("movements", {
      orgId: product.orgId,
      productId: args.productId,
      sku: product.sku,
      type: "stock_adjustment",
      quantityBefore: product.stockQuantity,
      quantityChange: args.adjustment,
      quantityAfter: newQuantity,
      userId,
      createdAt: Date.now(),
      notes: args.notes,
    });
  },
});

// Get low stock products (owner and admin)
export const getLowStock = query({
  args: {
    orgId: v.id("organizations"),
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate org access (requireRole already does this, but explicit is better)
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    const threshold = args.threshold ?? 10;

    const products = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    return products.filter((p) => p.stockQuantity <= threshold);
  },
});

// Search products by name or SKU
export const search = query({
  args: {
    orgId: v.id("organizations"),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);

    const products = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const term = args.searchTerm.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  },
});

// Get product by SKU (internal helper)
export const getBySku = query({
  args: {
    orgId: v.id("organizations"),
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);

    return await ctx.db
      .query("products")
      .withIndex("by_org_sku", (q) => q.eq("orgId", args.orgId).eq("sku", args.sku))
      .first();
  },
});

export const seedInsert = internalMutation({
  args: {
    orgId: v.id("organizations"),
    sku: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    costOfGoods: v.number(),
    sellPrice: v.number(),
    stockQuantity: v.number(),
    warehouseLocation: v.string(),
    sop_packing: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    weight: v.optional(v.number()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Skip if SKU already exists
    const existing = await ctx.db
      .query("products")
      .withIndex("by_org_sku", (q) => q.eq("orgId", args.orgId).eq("sku", args.sku))
      .first();

    if (existing) {
      return { created: false as const, productId: existing._id as Id<"products"> };
    }

    const org = await ctx.db.get(args.orgId);
    const createdBy = (args.createdBy as Id<"users"> | undefined) ?? (org?.ownerId as Id<"users"> | undefined);

    if (!createdBy) {
      throw new Error("Seed insert requires a valid createdBy user");
    }

    const productId = await insertProduct(ctx, {
      orgId: args.orgId,
      sku: args.sku,
      name: args.name,
      description: args.description,
      costOfGoods: args.costOfGoods,
      sellPrice: args.sellPrice,
      stockQuantity: args.stockQuantity,
      warehouseLocation: args.warehouseLocation,
      sop_packing: args.sop_packing,
      weight: args.weight,
      length: args.length,
      width: args.width,
      height: args.height,
      createdBy,
    });
    return { created: true as const, productId };
  },
});

type InsertProductArgs = {
  orgId: Id<"organizations">;
  sku: string;
  name: string;
  description?: string;
  costOfGoods: number;
  sellPrice: number;
  stockQuantity: number;
  warehouseLocation: string;
  sop_packing?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  createdBy: Id<"users">;
};

async function insertProduct(ctx: MutationCtx, args: InsertProductArgs): Promise<Id<"products">> {
  const profitMargin = args.sellPrice - args.costOfGoods;

  const productId = await ctx.db.insert("products", {
    orgId: args.orgId,
    sku: args.sku,
    name: args.name,
    description: args.description,
    costOfGoods: args.costOfGoods,
    sellPrice: args.sellPrice,
    profitMargin,
    stockQuantity: args.stockQuantity,
    warehouseLocation: args.warehouseLocation,
    sop_packing: args.sop_packing,
    weight: args.weight,
    length: args.length,
    width: args.width,
    height: args.height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: args.createdBy,
  });

  return productId as Id<"products">;
}
