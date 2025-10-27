// convex/agents/analystAgent.ts - Business Analyst Agent for Owner

import type { Id } from "../_generated/dataModel";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalQuery } from "../_generated/server";
import { getUserOrgId, getUserRoles } from "../auth";
import { chatCompletion, toPlainText } from "../utils/llm";

// Analyze business data and answer questions
export const analyzeBusinessData = action({
  args: {
    query: v.string(),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    // Only owner can access business analyst
    if (!userRoles.includes("owner")) {
      throw new Error("Access denied: Only owners can access business analyst");
    }

    const targetOrgId = (args.orgId || userOrgId) as Id<"organizations">;

    // Verify access
    if (targetOrgId !== userOrgId) {
      throw new Error("Access denied: Cannot access data from other organizations");
    }

    // Gather comprehensive business data
    const businessData: any = await ctx.runQuery(internal.agents.analystAgent.getBusinessData, {
      orgId: targetOrgId,
    });

    // Generate AI analysis
    try {
      const result = await chatCompletion({
        messages: [
          {
            role: "system",
            content: `You are a professional business analyst for WhatThePack, an AI-powered logistics platform for D2C businesses.

Your role is to:
1. Analyze business data and provide actionable insights
2. Answer specific questions about sales, inventory, and operations
3. Identify trends, patterns, and opportunities
4. Provide recommendations for business growth
5. Present data clearly with numbers and percentages

When analyzing:
- Focus on actionable insights
- Use specific numbers from the data
- Compare current vs. historical performance
- Identify both opportunities and risks
- Provide concrete recommendations

Format your responses with:
- Clear structure (plain text with bullet points; no Markdown or bold)
- Key metrics highlighted
- Specific recommendations
- Next action items

Available data context:
${JSON.stringify(businessData, null, 2)}`,
          },
          {
            role: "user",
            content: args.query,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      });

      const response: string = toPlainText(result.content);

      if (!response) {
        throw new Error("Failed to generate analysis");
      }

      return {
        analysis: response,
        data: businessData,
        query: args.query,
        generatedAt: Date.now(),
      };
    } catch (error: any) {
      console.error("Business analyst error:", error);

      // Fallback response
      return {
        analysis: generateFallbackAnalysis(args.query, businessData),
        data: businessData,
        query: args.query,
        generatedAt: Date.now(),
        usedFallback: true,
      };
    }
  },
});

// Get comprehensive business data (internal)
export const getBusinessData = internalQuery({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Time periods
    const last30Days = now - 30 * 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;
    const last24Hours = now - 24 * 60 * 60 * 1000;

    // Get organization
    const org = await ctx.db.get(args.orgId);

    // Get all orders
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const last30DaysOrders = allOrders.filter((o) => o.createdAt >= last30Days);
    const last7DaysOrders = allOrders.filter((o) => o.createdAt >= last7Days);

    // Get all products
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Calculate metrics
    const metrics = calculateMetrics(allOrders, last30DaysOrders, last7DaysOrders, allProducts);

    // Product performance
    const productPerformance = calculateProductPerformance(last30DaysOrders, allProducts);

    // Time-based trends
    const trends = calculateTrends(allOrders, now);

    // Customer insights (if we have customer data)
    const customerInsights = calculateCustomerInsights(allOrders);

    // Inventory health
    const inventoryHealth = calculateInventoryHealth(allProducts, last30DaysOrders);

    return {
      organization: {
        name: org?.name,
        slug: org?.slug,
      },
      timeframe: {
        now,
        last24Hours,
        last7Days,
        last30Days,
      },
      metrics,
      productPerformance,
      trends,
      customerInsights,
      inventoryHealth,
    };
  },
});

// Calculate key metrics
function calculateMetrics(allOrders: any[], last30Days: any[], last7Days: any[], products: any[]) {
  const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalProfit = allOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
  const totalOrders = allOrders.length;

  const last30Revenue = last30Days.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const last30Profit = last30Days.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
  const last30Orders = last30Days.length;

  const last7Revenue = last7Days.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const last7Profit = last7Days.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
  const last7Orders = last7Days.length;

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const avgProfitPerOrder = totalOrders > 0 ? totalProfit / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const totalInventoryValue = products.reduce((sum, p) => sum + p.costOfGoods * p.stockQuantity, 0);
  const totalInventoryUnits = products.reduce((sum, p) => sum + p.stockQuantity, 0);

  return {
    allTime: {
      revenue: totalRevenue,
      profit: totalProfit,
      orders: totalOrders,
      avgOrderValue,
      avgProfitPerOrder,
      profitMargin,
    },
    last30Days: {
      revenue: last30Revenue,
      profit: last30Profit,
      orders: last30Orders,
      avgOrderValue: last30Orders > 0 ? last30Revenue / last30Orders : 0,
      profitMargin: last30Revenue > 0 ? (last30Profit / last30Revenue) * 100 : 0,
    },
    last7Days: {
      revenue: last7Revenue,
      profit: last7Profit,
      orders: last7Orders,
      avgOrderValue: last7Orders > 0 ? last7Revenue / last7Orders : 0,
      profitMargin: last7Revenue > 0 ? (last7Profit / last7Revenue) * 100 : 0,
    },
    inventory: {
      totalValue: totalInventoryValue,
      totalUnits: totalInventoryUnits,
      productCount: products.length,
    },
  };
}

// Calculate product performance
function calculateProductPerformance(orders: any[], products: any[]) {
  const productStats = new Map<
    string,
    {
      name: string;
      revenue: number;
      profit: number;
      unitsSold: number;
      avgPrice: number;
      profitMargin: number;
      stock: number;
    }
  >();

  // Calculate from orders
  for (const order of orders) {
    for (const item of order.items) {
      const current = productStats.get(item.sku) || {
        name: item.productName,
        revenue: 0,
        profit: 0,
        unitsSold: 0,
        avgPrice: 0,
        profitMargin: 0,
        stock: 0,
      };

      current.revenue += item.unitPrice * item.quantity;
      current.profit += (item.unitPrice - item.unitCost) * item.quantity;
      current.unitsSold += item.quantity;

      productStats.set(item.sku, current);
    }
  }

  // Add current stock info
  for (const product of products) {
    const stats = productStats.get(product.sku);
    if (stats) {
      stats.stock = product.stockQuantity;
      stats.avgPrice = stats.unitsSold > 0 ? stats.revenue / stats.unitsSold : product.sellPrice;
      stats.profitMargin = stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0;
    } else {
      // Product with no sales
      productStats.set(product.sku, {
        name: product.name,
        revenue: 0,
        profit: 0,
        unitsSold: 0,
        avgPrice: product.sellPrice,
        profitMargin: product.profitMargin,
        stock: product.stockQuantity,
      });
    }
  }

  const sortedByRevenue = Array.from(productStats.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([sku, stats]) => ({ sku, ...stats }));

  const sortedByProfit = Array.from(productStats.entries())
    .sort((a, b) => b[1].profit - a[1].profit)
    .map(([sku, stats]) => ({ sku, ...stats }));

  const sortedByUnits = Array.from(productStats.entries())
    .sort((a, b) => b[1].unitsSold - a[1].unitsSold)
    .map(([sku, stats]) => ({ sku, ...stats }));

  return {
    topByRevenue: sortedByRevenue.slice(0, 10),
    topByProfit: sortedByProfit.slice(0, 10),
    topByUnits: sortedByUnits.slice(0, 10),
    slowMoving: sortedByUnits.filter((p) => p.unitsSold === 0 && p.stock > 0),
  };
}

// Calculate trends over time
function calculateTrends(orders: any[], now: number) {
  const dailyStats = new Map<
    string,
    {
      revenue: number;
      profit: number;
      orders: number;
    }
  >();

  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;

    const current = dailyStats.get(dateKey) || { revenue: 0, profit: 0, orders: 0 };
    current.revenue += order.totalPrice || 0;
    current.profit += order.totalProfit || 0;
    current.orders += 1;

    dailyStats.set(dateKey, current);
  }

  // Get last 30 days for trend analysis
  const last30DaysData = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const stats = dailyStats.get(dateKey) || { revenue: 0, profit: 0, orders: 0 };
    last30DaysData.push({
      date: dateKey,
      ...stats,
    });
  }

  return {
    daily: last30DaysData,
    summary: {
      avgDailyRevenue: last30DaysData.reduce((sum, d) => sum + d.revenue, 0) / 30,
      avgDailyProfit: last30DaysData.reduce((sum, d) => sum + d.profit, 0) / 30,
      avgDailyOrders: last30DaysData.reduce((sum, d) => sum + d.orders, 0) / 30,
    },
  };
}

// Calculate customer insights
function calculateCustomerInsights(orders: any[]) {
  const customerOrders = new Map<string, number>();
  const customerRevenue = new Map<string, number>();

  for (const order of orders) {
    const customerId = order.customerEmail || order.customerPhone || order.customerName;
    customerOrders.set(customerId, (customerOrders.get(customerId) || 0) + 1);
    customerRevenue.set(customerId, (customerRevenue.get(customerId) || 0) + (order.totalPrice || 0));
  }

  const repeatCustomers = Array.from(customerOrders.entries()).filter(([_, count]) => count > 1).length;

  const totalCustomers = customerOrders.size;
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

  const topCustomers = Array.from(customerRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([customer, revenue]) => ({
      customer,
      revenue,
      orders: customerOrders.get(customer) || 0,
    }));

  return {
    totalCustomers,
    repeatCustomers,
    repeatRate,
    topCustomers,
  };
}

// Calculate inventory health
function calculateInventoryHealth(products: any[], orders: any[]) {
  const totalValue = products.reduce((sum, p) => sum + p.costOfGoods * p.stockQuantity, 0);

  const lowStock = products.filter((p) => p.stockQuantity <= 5 && p.stockQuantity > 0);
  const outOfStock = products.filter((p) => p.stockQuantity === 0);
  const overStock = products.filter((p) => p.stockQuantity > 100);

  // Calculate turnover (simplified)
  const last30DaysItems = orders.filter((o) => o.createdAt >= Date.now() - 30 * 24 * 60 * 60 * 1000).flatMap((o) => o.items);

  const unitsSoldLast30Days = last30DaysItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalStock = products.reduce((sum, p) => sum + p.stockQuantity, 0);
  const turnoverRate = totalStock > 0 ? (unitsSoldLast30Days / totalStock) * 100 : 0;

  return {
    totalValue,
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    overStock: overStock.length,
    turnoverRate,
    lowStockItems: lowStock.map((p) => ({ sku: p.sku, name: p.name, quantity: p.stockQuantity })),
    outOfStockItems: outOfStock.map((p) => ({ sku: p.sku, name: p.name })),
  };
}

// Fallback analysis without LLM
function generateFallbackAnalysis(query: string, data: any): string {
  const queryLower = query.toLowerCase();

  let analysis = `Business Analysis\n\n`;

  // Handle specific queries
  if (queryLower.includes("sales") || queryLower.includes("revenue") || queryLower.includes("trend")) {
    analysis += `📊 SALES PERFORMANCE\n`;
    analysis += `• Last 30 days revenue: $${data.metrics.last30Days.revenue.toFixed(2)}\n`;
    analysis += `• Last 7 days revenue: $${data.metrics.last7Days.revenue.toFixed(2)}\n`;
    analysis += `• Average order value: $${data.metrics.last30Days.avgOrderValue.toFixed(2)}\n`;
    analysis += `• Total orders (30 days): ${data.metrics.last30Days.orders}\n\n`;

    if (data.trends.daily.length > 0) {
      analysis += `Trend: Average daily revenue is $${data.trends.summary.avgDailyRevenue.toFixed(2)}\n\n`;
    }
  }

  if (queryLower.includes("profit") || queryLower.includes("margin")) {
    analysis += `💰 PROFITABILITY\n`;
    analysis += `• Last 30 days profit: $${data.metrics.last30Days.profit.toFixed(2)}\n`;
    analysis += `• Profit margin: ${data.metrics.last30Days.profitMargin.toFixed(1)}%\n`;
    analysis += `• Average profit per order: $${data.metrics.last30Days.avgOrderValue > 0 ? (data.metrics.last30Days.profit / data.metrics.last30Days.orders).toFixed(2) : 0}\n\n`;
  }

  if (queryLower.includes("product") || queryLower.includes("best") || queryLower.includes("top")) {
    analysis += `🏆 TOP PRODUCTS (Last 30 days)\n`;
    for (const product of data.productPerformance.topByRevenue.slice(0, 5)) {
      analysis += `• ${product.name}: $${product.revenue.toFixed(2)} (${product.unitsSold} sold)\n`;
    }
    analysis += `\n`;
  }

  if (queryLower.includes("inventory") || queryLower.includes("stock")) {
    analysis += `📦 INVENTORY HEALTH\n`;
    analysis += `• Total inventory value: $${data.inventoryHealth.totalValue.toFixed(2)}\n`;
    analysis += `• Low stock items: ${data.inventoryHealth.lowStock}\n`;
    analysis += `• Out of stock items: ${data.inventoryHealth.outOfStock}\n`;
    analysis += `• Turnover rate: ${data.inventoryHealth.turnoverRate.toFixed(1)}%\n\n`;
  }

  // Always add recommendations
  analysis += `💡 RECOMMENDATIONS\n`;

  if (data.inventoryHealth.outOfStock > 0) {
    analysis += `• Restock ${data.inventoryHealth.outOfStock} out-of-stock items immediately\n`;
  }

  if (data.inventoryHealth.lowStock > 0) {
    analysis += `• ${data.inventoryHealth.lowStock} items are running low - reorder soon\n`;
  }

  if (data.metrics.last30Days.profitMargin < 20) {
    analysis += `• Profit margin is below 20% - review pricing strategy\n`;
  }

  if (data.productPerformance.slowMoving.length > 0) {
    analysis += `• ${data.productPerformance.slowMoving.length} products have not sold - consider promotions\n`;
  }

  return analysis;
}
