// convex/agents/ragAgent.ts - Role-Aware RAG Implementation

import type { Id } from "../_generated/dataModel";

import { v } from "convex/values";

import { query } from "../_generated/server";
import { getUserOrgId, getUserRoles } from "../auth";
import { chatCompletion } from "../utils/llm";

// Role-aware query answering with filtered context
export const answerQuery = query({
  args: {
    prompt: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional, for explicit org selection
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user's role and organization from JWT
    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    // Use provided orgId or default to user's org
    const targetOrgId = (args.orgId || userOrgId) as Id<"organizations">;

    // Verify user can access the target organization
    if (targetOrgId !== userOrgId) {
      throw new Error("Access denied: Cannot access data from other organizations");
    }

    const primaryRole = userRoles[0] || "unknown";

    let contextData: any[] = [];

    // Role-Based Data Access (Limit Knowledge)
    if (primaryRole === "owner") {
      // Owner can access all data including financials
      contextData = await ctx.db
        .query("products")
        .withIndex("by_orgId", (q) => q.eq("orgId", targetOrgId))
        .collect();

      // Add recent orders for business insights
      const recentOrders = await ctx.db
        .query("orders")
        .withIndex("by_org_created", (q) => q.eq("orgId", targetOrgId))
        .order("desc")
        .take(50);

      contextData.push(...recentOrders);
    } else if (primaryRole === "admin") {
      // Admin can access order status and inventory levels (no financial data)
      contextData = await ctx.db
        .query("products")
        .withIndex("by_orgId", (q) => q.eq("orgId", targetOrgId))
        .collect();

      // Filter out financial data
      contextData = contextData.map((p: any) => ({
        sku: p.sku,
        name: p.name,
        description: p.description,
        stockQuantity: p.stockQuantity,
        warehouseLocation: p.warehouseLocation,
        sop_packing: p.sop_packing,
      }));

      // Add order data (without financial details)
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_org_status", (q) => q.eq("orgId", targetOrgId))
        .collect();

      contextData.push(
        ...orders.map((o: any) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          recipientName: o.recipientName,
          createdAt: o.createdAt,
          items: o.items,
        })),
      );
    } else if (primaryRole === "packer") {
      // Packer can ONLY access SOPs, locations, and current stock levels
      contextData = await ctx.db
        .query("products")
        .withIndex("by_orgId", (q) => q.eq("orgId", targetOrgId))
        .collect();

      // Filter to only warehouse-relevant information
      contextData = contextData.map((p: any) => ({
        sku: p.sku,
        name: p.name,
        sop_packing: p.sop_packing,
        warehouseLocation: p.warehouseLocation,
        stockQuantity: p.stockQuantity,
        weight: p.weight,
        dimensions: {
          length: p.length,
          width: p.width,
          height: p.height,
        },
      }));

      // Add only paid orders (packing queue)
      const packingQueue = await ctx.db
        .query("orders")
        .withIndex("by_org_status", (q) => q.eq("orgId", targetOrgId).eq("status", "paid"))
        .order("asc")
        .collect();

      contextData.push(
        ...packingQueue.map((o: any) => ({
          orderNumber: o.orderNumber,
          recipientName: o.recipientName,
          items: o.items,
          weight: o.weight,
          specialInstructions: o.specialInstructions,
        })),
      );
    }

    // Prepare context for LLM (pre-filtered by role)
    const relevantContext = JSON.stringify(contextData, null, 2);

    // Get role-specific system prompt
    const systemPrompt = getRoleSystemPrompt(primaryRole, relevantContext);

    try {
      const result = await chatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = result.content;

      if (!response) {
        throw new Error("No response from AI model");
      }

      return {
        response,
        role: primaryRole,
        contextSize: contextData.length,
      };
    } catch (error: any) {
      console.error("RAG Agent error:", error);

      // Fallback responses for common questions
      if (args.prompt.toLowerCase().includes("profit") && primaryRole !== "owner") {
        return {
          response:
            "I'm sorry, but you don't have permission to access financial information. Please ask the owner for profit-related questions.",
          role: primaryRole,
          contextSize: 0,
        };
      }

      throw new Error(`Failed to process query: ${error.message}`);
    }
  },
});

// Get packing instructions for a specific product
export const getPackingInstructions = query({
  args: {
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    const primaryRole = userRoles[0] || "unknown";

    // Only packers and admins can get packing instructions
    if (!["packer", "admin", "owner"].includes(primaryRole)) {
      throw new Error("Access denied");
    }

    // Find the product
    const product = await ctx.db
      .query("products")
      .withIndex("by_orgId", (q) => q.eq("orgId", userOrgId))
      .filter((q) => q.eq(q.field("sku"), args.sku))
      .first();

    if (!product) {
      throw new Error(`Product with SKU ${args.sku} not found`);
    }

    // Return only relevant information for the role
    if (primaryRole === "packer") {
      return {
        sku: product.sku,
        name: product.name,
        sop_packing: product.sop_packing || "No specific packing instructions available",
        warehouseLocation: product.warehouseLocation || "Location not specified",
        stockQuantity: product.stockQuantity,
        weight: product.weight,
        dimensions: {
          length: product.length,
          width: product.width,
          height: product.height,
        },
      };
    } else {
      // Admin and owner get full product info
      return product;
    }
  },
});

// Get packing queue for packers
export const getPackingQueue = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userRoles = await getUserRoles(ctx);
    const userOrgId = await getUserOrgId(ctx);

    const primaryRole = userRoles[0] || "unknown";

    // Only packers, admins, and owners can see packing queue
    if (!["packer", "admin", "owner"].includes(primaryRole)) {
      throw new Error("Access denied");
    }

    // Get paid orders (ready for packing)
    const packingQueue = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) => q.eq("orgId", userOrgId).eq("status", "paid"))
      .order("asc") // Oldest first
      .collect();

    return packingQueue.map((order: any) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      recipientName: order.recipientName,
      recipientAddress: `${order.recipientAddress}, ${order.recipientCity}, ${order.recipientProvince} ${order.recipientPostalCode}`,
      items: order.items,
      weight: order.weight,
      specialInstructions: order.specialInstructions,
      createdAt: order.createdAt,
    }));
  },
});

// Helper function to get role-specific system prompts
function getRoleSystemPrompt(role: string, context: string): string {
  switch (role) {
    case "owner":
      return `You are a business intelligence assistant for WhatThePack. You're helping a business owner understand their operations and finances.

Context about their business:
${context}

You have access to ALL business data including:
- Product catalog with costs and pricing
- Order history and financial data
- Inventory levels and locations
- Staff performance metrics

Provide helpful insights about:
- Profit margins and trends
- Sales performance
- Inventory management
- Business optimization suggestions

Be concise but thorough. Focus on actionable insights that help grow their business.`;

    case "admin":
      return `You are an order management assistant for WhatThePack. You're helping an admin manage daily operations.

Context about current operations:
${context}

You can help with:
- Order status and tracking
- Inventory levels (without financial data)
- Customer order details
- Shipping and logistics coordination

You CANNOT discuss:
- Profit margins or financial data
- Cost of goods sold
- Business performance metrics

Focus on helping them manage orders efficiently and keep customers happy.`;

    case "packer":
      return `You are a warehouse assistant for WhatThePack. You're helping a packer with their daily tasks.

Context about current packing queue and products:
${context}

You can ONLY help with:
- Packing instructions (SOPs)
- Product locations in the warehouse
- Current stock levels
- Order details for packing
- Package dimensions and weights

You CANNOT discuss:
- Financial information or profits
- Customer data beyond what's needed for packing
- Business performance

Keep responses short and practical. Focus on helping them pack orders correctly and efficiently.`;

    default:
      return `You are an assistant for WhatThePack. Answer based only on the provided context:
${context}

If you don't have enough information to answer, say so clearly.`;
  }
}
