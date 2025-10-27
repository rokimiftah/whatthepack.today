// convex/analytics.ts - Business Analytics and Insights

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, query } from "./_generated/server";
import { requireRole } from "./auth";
import { requireOrgAccess } from "./security";

// Get KPIs for owner dashboard
export const getDashboardKPIs = query({
  args: {
    orgId: v.id("organizations"),
    dateRange: v.optional(
      v.object({
        startDate: v.number(),
        endDate: v.number(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    // Default to last 30 days if no date range provided
    const endDate = args.dateRange?.endDate || Date.now();
    const startDate = args.dateRange?.startDate || endDate - 30 * 24 * 60 * 60 * 1000;

    // Get orders in date range
    const orders = await ctx.runQuery((api.orders as any).getByDateRange, {
      orgId: args.orgId,
      startDate,
      endDate,
    });

    // Calculate basic metrics
    const totalOrders = orders.length;
    const shippedOrders = orders.filter((o: any) => o.status === "shipped").length;
    const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;

    const totalRevenue = orders
      .filter((o: any) => o.status !== "cancelled")
      .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);

    const totalProfit = orders
      .filter((o: any) => o.status !== "cancelled")
      .reduce((sum: number, o: any) => sum + (o.totalProfit || 0), 0);

    // Get product performance
    const productStats = await getProductPerformance(ctx, args.orgId, startDate, endDate);

    // Get staff performance
    const staffStats = await getStaffPerformance(ctx, args.orgId, startDate, endDate);

    return {
      summary: {
        totalOrders,
        shippedOrders,
        cancelledOrders,
        completionRate: totalOrders > 0 ? (shippedOrders / totalOrders) * 100 : 0,
        totalRevenue,
        totalProfit,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      },
      productPerformance: productStats,
      staffPerformance: staffStats,
      dateRange: { startDate, endDate },
    };
  },
});

// Get sales trends over time
export const getSalesTrends = query({
  args: {
    orgId: v.id("organizations"),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const endDate = args.endDate || Date.now();
    const startDate = args.startDate || endDate - 90 * 24 * 60 * 60 * 1000; // Default 90 days

    const orders = await ctx.runQuery((api.orders as any).getByDateRange, {
      orgId: args.orgId,
      startDate,
      endDate,
    });

    // Group orders by period
    const groupedData = groupOrdersByPeriod(orders, args.period, startDate, endDate);

    return {
      period: args.period,
      data: groupedData,
      summary: {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0),
        averageDailyOrders: calculateAverageDailyOrders(orders, startDate, endDate),
      },
    };
  },
});

// Get product performance analytics
export const getProductAnalytics = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const limit = args.limit || 20;
    const products = await ctx.runQuery(api.inventory.list, { orgId: args.orgId });

    const productAnalytics: any[] = [];

    for (const product of (products as any[]).slice(0, limit)) {
      // Get orders containing this product
      const productOrders = await ctx.runQuery((api.orders as any).getByProduct, {
        orgId: args.orgId,
        productId: product._id,
      });

      const totalSold = productOrders.reduce(
        (sum: number, order: any) => sum + (order.items?.find((item: any) => item.productId === product._id)?.quantity || 0),
        0,
      );

      const revenue = productOrders.reduce((sum: number, order: any) => {
        const item = order.items?.find((it: any) => it.productId === product._id);
        if (!item) return sum;
        return sum + (item.unitPrice || 0) * (item.quantity || 0);
      }, 0);

      const profit = productOrders.reduce((sum: number, order: any) => {
        const item = order.items?.find((it: any) => it.productId === product._id);
        if (!item) return sum;
        const unitProfit = (item.unitPrice || 0) - (item.unitCost || 0);
        return sum + unitProfit * (item.quantity || 0);
      }, 0);

      productAnalytics.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        currentStock: product.stockQuantity,
        totalSold,
        revenue,
        profit,
        profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
        lowStock: product.stockQuantity <= 5,
        lastSold: productOrders.length > 0 ? Math.max(...productOrders.map((o: any) => o.createdAt)) : null,
      });
    }

    // Sort by revenue (highest first)
    productAnalytics.sort((a: any, b: any) => b.revenue - a.revenue);

    return {
      products: productAnalytics,
      summary: {
        totalProducts: products.length,
        lowStockCount: productAnalytics.filter((p: any) => p.lowStock).length,
        outOfStockCount: productAnalytics.filter((p: any) => p.currentStock === 0).length,
      },
    };
  },
});

// Get staff performance metrics
export const getStaffAnalytics = query({
  args: {
    orgId: v.id("organizations"),
    dateRange: v.optional(
      v.object({
        startDate: v.number(),
        endDate: v.number(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const endDate = args.dateRange?.endDate || Date.now();
    const startDate = args.dateRange?.startDate || endDate - 30 * 24 * 60 * 60 * 1000;

    const staff = await ctx.runQuery(internal.users.listByOrg, { orgId: args.orgId });
    const staffAnalytics: any[] = [];

    for (const member of staff as any[]) {
      if (member.role === "owner") continue; // Skip owner in staff analytics

      const metrics = {
        ordersProcessed: 0,
        averageTimePerOrder: 0,
        totalValue: 0,
      };

      if (member.role === "packer") {
        // Get orders packed by this user
        const packedOrders = await ctx.runQuery((api.orders as any).getByPacker, {
          orgId: args.orgId,
          packerId: member._id,
          startDate,
          endDate,
        });

        metrics.ordersProcessed = packedOrders.length;

        if (packedOrders.length > 0) {
          const totalPackingTime = packedOrders.reduce((sum: number, order: any) => {
            if (order.packedAt && order.createdAt) {
              return sum + (order.packedAt - order.createdAt);
            }
            return sum;
          }, 0);

          metrics.averageTimePerOrder = totalPackingTime / packedOrders.length;
        }

        metrics.totalValue = packedOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
      } else if (member.role === "admin") {
        // Get orders created by this admin
        const createdOrders = await ctx.runQuery((api.orders as any).getByCreator, {
          orgId: args.orgId,
          creatorId: member._id,
          startDate,
          endDate,
        });

        metrics.ordersProcessed = createdOrders.length;
        metrics.totalValue = createdOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
      }

      staffAnalytics.push({
        userId: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        ...metrics,
        efficiency: metrics.ordersProcessed > 0 ? metrics.totalValue / metrics.ordersProcessed : 0,
      });
    }

    return {
      staff: staffAnalytics,
      dateRange: { startDate, endDate },
    };
  },
});

// Generate AI-powered business insights
export const generateBusinessInsights = action({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get recent data for analysis
    const endDate = Date.now();
    const startDate = endDate - 30 * 24 * 60 * 60 * 1000;

    const kpis = await ctx.runQuery(api.analytics.getDashboardKPIs, {
      orgId: args.orgId,
      dateRange: { startDate, endDate },
    });

    const trends = await ctx.runQuery(api.analytics.getSalesTrends, {
      orgId: args.orgId,
      period: "daily",
      startDate,
      endDate,
    });

    const products = await ctx.runQuery(api.analytics.getProductAnalytics, {
      orgId: args.orgId,
      limit: 10,
    });

    // TODO: Use LLM to generate insights
    // For now, return basic insights based on data patterns
    const insights = generateBasicInsights(kpis, trends, products);

    return {
      insights,
      generatedAt: Date.now(),
      dataPeriod: { startDate, endDate },
    };
  },
});

// Helper functions

async function getProductPerformance(ctx: any, orgId: string, startDate: number, endDate: number) {
  const products = await ctx.runQuery(api.inventory.list, { orgId });
  const performance = [];

  for (const product of products.slice(0, 5)) {
    // Top 5 products
    const orders = await ctx.runQuery((api.orders as any).getByProduct, {
      orgId,
      productId: product._id,
    });

    const recentOrders = orders.filter((o: any) => o.createdAt >= startDate && o.createdAt <= endDate);
    const sold = recentOrders.reduce(
      (sum: number, order: any) => sum + (order.items?.find((item: any) => item.productId === product._id)?.quantity || 0),
      0,
    );

    performance.push({
      sku: product.sku,
      name: product.name,
      sold,
      stockRemaining: product.stockQuantity,
    });
  }

  return performance.sort((a, b) => b.sold - a.sold);
}

async function getStaffPerformance(ctx: any, orgId: string, startDate: number, endDate: number) {
  const packers = await ctx.runQuery(internal.users.listByOrg, { orgId });
  const packersFiltered = (packers as any[]).filter((u: any) => u.role === "packer");
  const performance = [];

  for (const packer of packersFiltered.slice(0, 3)) {
    // Top 3 packers
    const orders = await ctx.runQuery((api.orders as any).getByPacker, {
      orgId,
      packerId: packer._id,
      startDate,
      endDate,
    });

    const avgTime =
      orders.length > 0
        ? orders.reduce((sum: number, order: any) => sum + (order.packedAt - order.createdAt), 0) / orders.length
        : 0;

    performance.push({
      name: packer.name,
      ordersProcessed: orders.length,
      averageTime: avgTime,
    });
  }

  return performance.sort((a, b) => b.ordersProcessed - a.ordersProcessed);
}

function groupOrdersByPeriod(orders: any[], period: string, _startDate: number, _endDate: number) {
  const grouped: Record<string, any> = {};

  orders.forEach((order) => {
    let key: string;
    const date = new Date(order.createdAt);

    switch (period) {
      case "daily":
        key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        break;
      case "weekly": {
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        key = weekStart.toISOString().split("T")[0];
        break;
      }
      case "monthly":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      default:
        key = date.toISOString().split("T")[0];
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        orders: 0,
        revenue: 0,
        profit: 0,
      };
    }

    grouped[key].orders += 1;
    grouped[key].revenue += order.totalPrice || 0;
    grouped[key].profit += order.totalProfit || 0;
  });

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateAverageDailyOrders(orders: any[], startDate: number, endDate: number) {
  const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
  return days > 0 ? orders.length / days : 0;
}

function generateBasicInsights(kpis: any, trends: any, products: any) {
  const insights = [];

  // Revenue trend
  const recentRevenue = trends.data.slice(-7).reduce((sum: number, day: any) => sum + day.revenue, 0);
  const previousRevenue = trends.data.slice(-14, -7).reduce((sum: number, day: any) => sum + day.revenue, 0);

  if (recentRevenue > previousRevenue * 1.1) {
    insights.push({
      type: "positive",
      title: "Revenue Increasing",
      description: "Revenue has increased by more than 10% compared to the previous week.",
    });
  } else if (recentRevenue < previousRevenue * 0.9) {
    insights.push({
      type: "warning",
      title: "Revenue Declining",
      description: "Revenue has decreased by more than 10% compared to the previous week.",
    });
  }

  // Low stock alerts
  const lowStockCount = products.products.filter((p: any) => p.lowStock).length;
  if (lowStockCount > 0) {
    insights.push({
      type: "warning",
      title: "Low Stock Items",
      description: `${lowStockCount} products are running low on stock and need reordering.`,
    });
  }

  // Completion rate
  if (kpis.summary.completionRate < 90) {
    insights.push({
      type: "warning",
      title: "Order Completion Rate",
      description: `Only ${kpis.summary.completionRate.toFixed(1)}% of orders are being completed. Consider reviewing your fulfillment process.`,
    });
  }

  // Top performer
  if (products.products.length > 0) {
    const topProduct = products.products[0];
    insights.push({
      type: "info",
      title: "Top Performing Product",
      description: `${topProduct.name} is your best seller with ${topProduct.totalSold} units sold.`,
    });
  }

  return insights;
}
