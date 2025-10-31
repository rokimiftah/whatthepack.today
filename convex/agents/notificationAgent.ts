// convex/agents/notificationAgent.ts - Proactive notification triggers

import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { sendEmail } from "../emails";
import { buildOrgUrl } from "../utils/urls";

// Send stock alert notification
export const sendStockAlert = internalAction({
  args: {
    orgId: v.id("organizations"),
    productId: v.id("products"),
    reporterId: v.id("users"), // Who reported the stockout
    currentStock: v.number(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Per-org hourly quota (max 5 emails/hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentCount = await ctx.runQuery(internal.emails.getRecentEmailLogsCount, {
        orgId: args.orgId,
        since: oneHourAgo,
      });
      if (recentCount >= 5) {
        return { success: false, throttled: true, message: "Email quota exceeded for this organization" };
      }

      // Get product details
      const product = await ctx.runQuery(api.inventory.get, {
        productId: args.productId,
      });

      if (!product) {
        throw new Error("Product not found");
      }

      // Get organization details
      const org = await ctx.runQuery(internal.organizations.get, {
        orgId: args.orgId,
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      // Get reporter details
      const reporter = await ctx.runQuery(internal.users.getUserById, {
        userId: args.reporterId,
      });

      // Get owners and admins to notify
      const orgUsers: any[] = await ctx.runQuery(internal.users.listByOrg, { orgId: args.orgId });
      const staffToNotify: any[] = orgUsers.filter((u: any) => u.role === "owner");
      const admins: any[] = orgUsers.filter((u: any) => u.role === "admin");
      const allRecipients: any[] = [...staffToNotify, ...admins];

      // Send email to each recipient
      const emailPromises = allRecipients.map(async (recipient: any) => {
        return sendEmail({
          to: recipient.email,
          subject: `🚨 CRITICAL STOCK ALERT - ${product.sku} (${product.name})`,
          template: "stock-alert",
          data: {
            organizationName: org.name,
            productSku: product.sku,
            productName: product.name,
            currentStock: args.currentStock,
            reporterName: reporter?.name || "Unknown",
            reportTime: new Date().toLocaleString(),
            warehouseLocation: product.warehouseLocation,
            lowStockThreshold: 5, // Could be configurable per product
            reorderLink: buildOrgUrl(org.slug, "/inventory"), // Future page
          },
        });
      });

      await Promise.all(emailPromises);

      // Persist logs per recipient
      for (const recipient of allRecipients) {
        await ctx.runMutation(internal.emails.createEmailLog, {
          orgId: args.orgId,
          recipientEmail: recipient.email,
          subject: `🚨 CRITICAL STOCK ALERT - ${product.sku} (${product.name})`,
          template: "stock-alert",
        });
      }

      return {
        success: true,
        notifiedCount: allRecipients.length,
      };
    } catch (error: any) {
      console.error("Stock alert error:", error);

      // Optional: log failure

      throw new Error(`Failed to send stock alert: ${error.message}`);
    }
  },
});

// Send order failure notification
export const sendOrderFailureAlert = internalAction({
  args: {
    orgId: v.id("organizations"),
    orderId: v.id("orders"),
    error: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Per-org hourly quota (max 5 emails/hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentCount = await ctx.runQuery(internal.emails.getRecentEmailLogsCount, {
        orgId: args.orgId,
        since: oneHourAgo,
      });
      if (recentCount >= 5) {
        return { success: false, throttled: true, message: "Email quota exceeded for this organization" };
      }

      const order = await ctx.runQuery(api.orders.get, {
        orderId: args.orderId,
      });

      if (!order) {
        throw new Error("Order not found");
      }

      const org = await ctx.runQuery(internal.organizations.get, {
        orgId: args.orgId,
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      // Notify admins and owners
      const orgUsers2: any[] = await ctx.runQuery(internal.users.listByOrg, { orgId: args.orgId });
      const recipients: any[] = orgUsers2.filter((u: any) => u.role === "owner");
      const admins: any[] = orgUsers2.filter((u: any) => u.role === "admin");
      const allRecipients: any[] = [...recipients, ...admins];

      const emailPromises = allRecipients.map(async (recipient: any) => {
        return sendEmail({
          to: recipient.email,
          subject: `⚠️ Order Processing Failed - ${order.orderNumber}`,
          template: "order-failure",
          data: {
            organizationName: org.name,
            orderNumber: order.orderNumber,
            customerName: order.recipientName,
            error: args.error,
            failureTime: new Date().toLocaleString(),
            orderLink: buildOrgUrl(org.slug, `/orders/${order._id}`),
          },
        });
      });

      await Promise.all(emailPromises);

      // Persist logs per recipient
      for (const recipient of allRecipients) {
        await ctx.runMutation(internal.emails.createEmailLog, {
          orgId: args.orgId,
          recipientEmail: recipient.email,
          subject: `⚠️ Order Processing Failed - ${order.orderNumber}`,
          template: "order-failure",
        });
      }

      return {
        success: true,
        notifiedCount: allRecipients.length,
      };
    } catch (error: any) {
      console.error("Order failure alert error:", error);
      throw new Error(`Failed to send order failure alert: ${error.message}`);
    }
  },
});

// Send daily briefing (triggered by cron job)
export const sendDailyBriefing = internalAction({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Per-org hourly quota (max 5 emails/hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentCount = await ctx.runQuery(internal.emails.getRecentEmailLogsCount, {
        orgId: args.orgId,
        since: oneHourAgo,
      });
      if (recentCount >= 5) {
        return { success: false, throttled: true, message: "Email quota exceeded for this organization" };
      }

      const org = await ctx.runQuery(internal.organizations.get, {
        orgId: args.orgId,
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      // Get yesterday's stats
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0)).getTime();
      const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999)).getTime();

      // Get orders from yesterday (fallback: list and filter)
      const allOrders: any[] = await ctx.runQuery(api.orders.list, { orgId: args.orgId });
      const yesterdayOrders: any[] = allOrders.filter((o: any) => o.createdAt >= startOfDay && o.createdAt <= endOfDay);

      // Get low stock products
      const lowStockProducts: any[] = await ctx.runQuery(api.inventory.getLowStock, {
        orgId: args.orgId,
        threshold: 5,
      });

      // Calculate metrics
      const totalOrders = yesterdayOrders.length;
      const shippedOrders = yesterdayOrders.filter((o: any) => o.status === "shipped").length;
      const totalRevenue = yesterdayOrders
        .filter((o: any) => o.status !== "cancelled")
        .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

      const estimatedProfit = yesterdayOrders
        .filter((o: any) => o.status !== "cancelled")
        .reduce((sum: number, o: any) => sum + (o.profit || 0), 0);

      // Get packer performance
      const packerStats: any[] = [];

      // Get owners to notify
      const orgUsers2: any[] = await ctx.runQuery(internal.users.listByOrg, { orgId: args.orgId });
      const owners: any[] = orgUsers2.filter((u: any) => u.role === "owner");

      const emailPromises = owners.map(async (owner: any) => {
        return sendEmail({
          to: owner.email,
          subject: `📊 Daily Business Briefing - ${org.name}`,
          template: "daily-briefing",
          data: {
            organizationName: org.name,
            date: yesterday.toLocaleDateString(),
            totalOrders,
            shippedOrders,
            totalRevenue,
            estimatedProfit,
            lowStockProducts: lowStockProducts.map((p: any) => ({
              sku: p.sku,
              name: p.name,
              stockQuantity: p.stockQuantity,
            })),
            packerStats,
            dashboardLink: buildOrgUrl(org.slug, "/dashboard"),
          },
        });
      });

      await Promise.all(emailPromises);

      // Persist logs per recipient
      for (const owner of owners) {
        await ctx.runMutation(internal.emails.createEmailLog, {
          orgId: args.orgId,
          recipientEmail: owner.email,
          subject: `📊 Daily Business Briefing - ${org.name}`,
          template: "daily-briefing",
        });
      }

      return {
        success: true,
        notifiedCount: owners.length,
        stats: {
          totalOrders,
          totalRevenue,
          lowStockCount: lowStockProducts.length,
        },
      };
    } catch (error: any) {
      console.error("Daily briefing error:", error);
      throw new Error(`Failed to send daily briefing: ${error.message}`);
    }
  },
});

// Send welcome email to new staff member
export const sendStaffWelcomeEmail = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    ticketUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.runQuery(internal.users.getUserById, {
        userId: args.userId,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const org = await ctx.runQuery(internal.organizations.get, {
        orgId: args.orgId,
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      await sendEmail({
        to: (user.email || "") as string,
        subject: `🎉 Welcome to ${org.name} - Complete Your Setup`,
        template: "staff-welcome",
        data: {
          organizationName: org.name,
          staffName: user.name,
          staffRole: user.role,
          setupLink: args.ticketUrl,
          loginUrl: buildOrgUrl(org.slug, "/login"),
          supportEmail: "support@whatthepack.today",
        },
      });

      // Optional: persist logs

      return { success: true };
    } catch (error: any) {
      console.error("Staff welcome email error:", error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }
  },
});

// Rate limiting helper - check if org has exceeded email limit
export const checkEmailRateLimit = internalAction({
  args: {
    orgId: v.id("organizations"),
    hourWindow: v.number(), // Default: 1 hour
    maxEmails: v.number(), // Default: 5 emails per hour
  },
  handler: async (_ctx, args): Promise<any> => {
    // Placeholder: allow sending (no rate limit storage implemented)
    const canSend = true;
    const remainingQuota = args.maxEmails;

    return {
      canSend,
      remainingQuota,
      recentCount: 0,
      resetTime: new Date(Date.now() + args.hourWindow * 60 * 60 * 1000).toISOString(),
    };
  },
});
