// convex/agents/briefingAgent.ts - Daily Briefing Agent for Owner

import type { Id } from "../_generated/dataModel";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalQuery, query } from "../_generated/server";
import { getUserOrgId, getUserRoles } from "../auth";
import { chatCompletion, toPlainText } from "../utils/llm";

// Generate daily briefing for owner
export const generateDailyBriefing = action({
  args: {
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    // Only owner can access daily briefing
    if (!userRoles.includes("owner")) {
      throw new Error("Access denied: Only owners can access daily briefing");
    }

    const targetOrgId = (args.orgId || userOrgId) as Id<"organizations">;

    // Verify access
    if (targetOrgId !== userOrgId) {
      throw new Error("Access denied: Cannot access data from other organizations");
    }

    // Gather data for briefing
    const briefingData: any = await ctx.runQuery(internal.agents.briefingAgent.getBriefingData, {
      orgId: targetOrgId,
    });

    // Generate LLM summary
    try {
      const result = await chatCompletion({
        messages: [
          {
            role: "system",
            content: `You are a business intelligence assistant for WhatThePack. Generate a concise daily briefing for a business owner.

Format the briefing as follows:
1. Greeting (Good morning/afternoon/evening based on time)
2. Today's overview (orders, revenue, profit)
3. Recent trends (last 7 days comparison)
4. Alerts (low stock, pending issues)
5. Recommendations (actionable insights)

Keep it brief, professional, and actionable. Use bullet points for clarity.

Output strictly as plain text. Do not use Markdown, asterisks for bold, or headings (#).`,
          },
          {
            role: "user",
            content: `Generate a daily briefing based on this data:\n\n${JSON.stringify(briefingData, null, 2)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const briefingText: string = toPlainText(result.content);

      if (!briefingText) {
        throw new Error("Failed to generate briefing");
      }

      return {
        briefing: briefingText,
        data: briefingData,
        generatedAt: Date.now(),
      };
    } catch (error: any) {
      console.error("Daily briefing generation error:", error);

      // Fallback to structured briefing without LLM
      return {
        briefing: generateFallbackBriefing(briefingData),
        data: briefingData,
        generatedAt: Date.now(),
        usedFallback: true,
      };
    }
  },
});

// Get briefing data (internal)
export const getBriefingData = internalQuery({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const last7Days = now - 7 * 24 * 60 * 60 * 1000;
    const last24Hours = now - 24 * 60 * 60 * 1000;

    // Get organization info
    const org = await ctx.db.get(args.orgId);

    // Today's orders
    const todayOrders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), todayStart))
      .collect();

    // Recent orders (last 24 hours)
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), last24Hours))
      .collect();

    // Last 7 days orders (for trends)
    const last7DaysOrders = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), last7Days))
      .collect();

    // Pending orders (paid but not shipped)
    const pendingOrders = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) => q.eq("orgId", args.orgId).eq("status", "paid"))
      .collect();

    // Shipped orders today
    const shippedToday = todayOrders.filter((o) => o.status === "shipped" || o.status === "delivered");

    // Low stock products
    const lowStockProducts = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.lte(q.field("stockQuantity"), 5))
      .collect();

    // Calculate metrics
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const todayProfit = todayOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
    const todayCost = todayOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);

    const last7DaysRevenue = last7DaysOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const last7DaysProfit = last7DaysOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

    // Average daily for comparison
    const avgDailyRevenue = last7DaysRevenue / 7;
    const avgDailyProfit = last7DaysProfit / 7;
    const avgDailyOrders = last7DaysOrders.length / 7;

    // Trends
    const revenueTrend = avgDailyRevenue > 0 ? ((todayRevenue - avgDailyRevenue) / avgDailyRevenue) * 100 : 0;
    const profitTrend = avgDailyProfit > 0 ? ((todayProfit - avgDailyProfit) / avgDailyProfit) * 100 : 0;
    const ordersTrend = avgDailyOrders > 0 ? ((todayOrders.length - avgDailyOrders) / avgDailyOrders) * 100 : 0;

    // Get top products by revenue (last 7 days)
    const productRevenue = new Map<string, { name: string; revenue: number; profit: number; quantity: number }>();

    for (const order of last7DaysOrders) {
      for (const item of order.items) {
        const current = productRevenue.get(item.sku) || {
          name: item.productName,
          revenue: 0,
          profit: 0,
          quantity: 0,
        };
        current.revenue += item.unitPrice * item.quantity;
        current.profit += (item.unitPrice - item.unitCost) * item.quantity;
        current.quantity += item.quantity;
        productRevenue.set(item.sku, current);
      }
    }

    const topProducts = Array.from(productRevenue.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([sku, data]) => ({ sku, ...data }));

    return {
      organization: {
        name: org?.name,
        slug: org?.slug,
      },
      timeframe: {
        todayStart,
        last24Hours,
        last7Days,
        currentTime: now,
      },
      today: {
        orders: todayOrders.length,
        revenue: todayRevenue,
        profit: todayProfit,
        cost: todayCost,
        shipped: shippedToday.length,
      },
      recent24h: {
        orders: recentOrders.length,
      },
      last7Days: {
        orders: last7DaysOrders.length,
        revenue: last7DaysRevenue,
        profit: last7DaysProfit,
        avgDailyRevenue,
        avgDailyProfit,
        avgDailyOrders,
      },
      trends: {
        revenue: revenueTrend,
        profit: profitTrend,
        orders: ordersTrend,
      },
      alerts: {
        pendingOrders: pendingOrders.length,
        lowStock: lowStockProducts.map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.stockQuantity,
          location: p.warehouseLocation,
        })),
      },
      insights: {
        topProducts,
        profitMargin: todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0,
      },
    };
  },
});

// Fallback briefing without LLM
function generateFallbackBriefing(data: any): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  let briefing = `${greeting}!\n\n`;

  // Overview
  briefing += `📊 TODAY'S OVERVIEW\n`;
  briefing += `• Orders: ${data.today.orders}\n`;
  briefing += `• Revenue: $${data.today.revenue.toFixed(2)}\n`;
  briefing += `• Profit: $${data.today.profit.toFixed(2)}\n`;
  briefing += `• Shipped: ${data.today.shipped} orders\n\n`;

  // Trends
  if (data.last7Days.orders > 0) {
    briefing += `📈 TRENDS (vs. 7-day average)\n`;
    briefing += `• Revenue: ${data.trends.revenue > 0 ? "+" : ""}${data.trends.revenue.toFixed(1)}%\n`;
    briefing += `• Profit: ${data.trends.profit > 0 ? "+" : ""}${data.trends.profit.toFixed(1)}%\n`;
    briefing += `• Orders: ${data.trends.orders > 0 ? "+" : ""}${data.trends.orders.toFixed(1)}%\n\n`;
  }

  // Alerts
  if (data.alerts.pendingOrders > 0 || data.alerts.lowStock.length > 0) {
    briefing += `⚠️ ALERTS\n`;

    if (data.alerts.pendingOrders > 0) {
      briefing += `• ${data.alerts.pendingOrders} orders pending packing\n`;
    }

    if (data.alerts.lowStock.length > 0) {
      briefing += `• Low stock items:\n`;
      for (const item of data.alerts.lowStock.slice(0, 3)) {
        briefing += `  - ${item.name} (${item.sku}): ${item.quantity} left\n`;
      }
      if (data.alerts.lowStock.length > 3) {
        briefing += `  - ... and ${data.alerts.lowStock.length - 3} more\n`;
      }
    }
    briefing += `\n`;
  }

  // Top products
  if (data.insights.topProducts.length > 0) {
    briefing += `🏆 TOP PRODUCTS (Last 7 days)\n`;
    for (const product of data.insights.topProducts.slice(0, 3)) {
      briefing += `• ${product.name}: $${product.revenue.toFixed(2)} (${product.quantity} sold)\n`;
    }
    briefing += `\n`;
  }

  // Recommendations
  briefing += `💡 RECOMMENDATIONS\n`;

  if (data.alerts.lowStock.length > 0) {
    briefing += `• Restock ${data.alerts.lowStock.length} products to prevent stockouts\n`;
  }

  if (data.alerts.pendingOrders > 0) {
    briefing += `• ${data.alerts.pendingOrders} orders need attention for shipping\n`;
  }

  if (data.trends.profit < -10) {
    briefing += `• Profit is declining. Review pricing or reduce costs\n`;
  } else if (data.trends.profit > 20) {
    briefing += `• Strong profit growth! Consider expanding inventory\n`;
  }

  if (data.insights.profitMargin < 20) {
    briefing += `• Profit margin is low (${data.insights.profitMargin.toFixed(1)}%). Consider price adjustments\n`;
  }

  return briefing;
}

// Get quick stats (for voice assistant)
export const getQuickStats = query({
  args: {},
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    // Only owner can access stats
    if (!userRoles.includes("owner")) {
      throw new Error("Access denied: Only owners can access stats");
    }

    const data: any = await ctx.runQuery(internal.agents.briefingAgent.getBriefingData, {
      orgId: userOrgId,
    });

    // Return concise stats for voice
    return {
      todayOrders: data.today.orders,
      todayRevenue: data.today.revenue,
      todayProfit: data.today.profit,
      pendingOrders: data.alerts.pendingOrders,
      lowStockCount: data.alerts.lowStock.length,
      topProduct: data.insights.topProducts[0]?.name || "None",
    };
  },
});
