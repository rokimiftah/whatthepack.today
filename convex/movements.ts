// convex/movements.ts - Stock Movement Audit Trail

import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireRole } from "./auth";
import { requireOrgAccess } from "./security";

// Get movements for a product (owner only)
export const getByProduct = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    // SECURITY: Validate user has access to this product's organization
    await requireOrgAccess(ctx, product.orgId);
    await requireRole(ctx, product.orgId, ["owner"]);

    const movements = await ctx.db
      .query("movements")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(args.limit ?? 100);

    return movements;
  },
});

// Get all movements for organization (owner only)
export const getByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const movements = await ctx.db
      .query("movements")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit ?? 100);

    return movements;
  },
});

// Get movements by date range (owner only)
export const getByDateRange = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const movements = await ctx.db
      .query("movements")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), args.startDate))
      .filter((q) => q.lte(q.field("createdAt"), args.endDate))
      .order("desc")
      .collect();

    return movements;
  },
});

// Get movement statistics (owner only)
export const getStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const movements = await ctx.db
      .query("movements")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const stats = {
      totalMovements: movements.length,
      byType: {
        order_created: 0,
        order_shipped: 0,
        order_cancelled: 0,
        stock_adjustment: 0,
        stock_in: 0,
      },
      totalStockOut: 0,
      totalStockIn: 0,
    };

    movements.forEach((m) => {
      stats.byType[m.type]++;
      if (m.quantityChange > 0) {
        stats.totalStockIn += m.quantityChange;
      } else {
        stats.totalStockOut += Math.abs(m.quantityChange);
      }
    });

    return stats;
  },
});
