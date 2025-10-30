// convex/emails.ts - Email Notifications via Resend

import { v } from "convex/values";
import { Resend } from "resend";

import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Send staff invitation email with password setup link
export const sendStaffInvite = action({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("packer")),
    ticketUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const to = args.email;
    const subject = `You're invited to ${org.name} on WhatThePack.today`;
    const staffName = args.name || to.split("@")[0];
    const loginUrl = `https://${org.slug}.whatthepack.today/login`;

    const data = {
      organizationName: org.name,
      staffName,
      staffRole: args.role,
      setupLink: args.ticketUrl,
      loginUrl,
      supportEmail: "support@whatthepack.today",
    };

    try {
      await sendEmail({ to, subject, template: "staff-welcome", data });
      // Optional: log email send
      await ctx.runMutation(internal.emails.createEmailLog, {
        orgId: args.orgId,
        recipientEmail: to,
        subject,
        template: "staff-welcome",
      });
      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to send staff invite: ${error.message}`);
    }
  },
});

// Send stock alert email
export const sendStockAlert = action({
  args: {
    orgId: v.id("organizations"),
    productSku: v.string(),
    productName: v.string(),
    currentStock: v.number(),
    recipientEmails: v.array(v.string()),
    reportedBy: v.string(), // Packer name
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const subject = `🚨 CRITICAL STOCK ALERT - ${args.productSku} (${args.productName})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charSet="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0b0b0b; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #7f1d1d; color: white; padding: 16px; border-radius: 8px; }
            .content { background: #161616; padding: 16px; border-radius: 8px; margin-top: 8px; }
            .button { display: inline-block; background: #e5e7eb; color: #111827; padding: 10px 16px; text-decoration: none; border-radius: 6px; margin-top: 12px; font-weight: 600; }
            .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">CRITICAL STOCK ALERT</h1>
              <p style="margin: 4px 0 0 0; opacity: 0.85;">${org.name}</p>
            </div>
            <div class="content">
              <p><strong>Product:</strong> ${args.productName} (${args.productSku})</p>
              <p><strong>Current Stock:</strong> ${args.currentStock}</p>
              <p><strong>Reported By:</strong> ${args.reportedBy}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              <a class="button" href="https://${org.slug}.whatthepack.today/inventory">View Inventory</a>
            </div>
            <p class="footer">This is an automated notification from WhatThePack.today</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
CRITICAL STOCK ALERT

Product: ${args.productName} (${args.productSku})
Current Stock: ${args.currentStock} units
Reported By: ${args.reportedBy}
Time: ${new Date().toLocaleString()}

This alert was automatically triggered when stock levels reached a critical threshold.

Recommended Action: Contact your vendor immediately to reorder this product.

View inventory at: https://${org.slug}.whatthepack.today/inventory

---
This is an automated notification from WhatThePack.today
    `.trim();

    try {
      // Send to all recipients
      for (const email of args.recipientEmails) {
        await resend.emails.send({
          from: "notifications@whatthepack.today",
          to: email,
          subject,
          html: htmlContent,
          text: textContent,
        });

        // Log email (simplified - just console log for now)
        console.log("Email sent:", { orgId: args.orgId, email, subject });
      }

      return { success: true, emailsSent: args.recipientEmails.length };
    } catch (error: any) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },
});

// Internal mutation to log emails
export const createEmailLog = internalMutation({
  args: {
    orgId: v.id("organizations"),
    recipientEmail: v.string(),
    subject: v.string(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, we would insert into emailLogs table
    await ctx.db.insert("emailLogs", {
      orgId: args.orgId,
      recipientEmail: args.recipientEmail,
      subject: args.subject,
      template: args.template,
      sentAt: Date.now(),
    });
  },
});

// Internal query: count recent email logs for rate limiting
export const getRecentEmailLogsCount = internalQuery({
  args: {
    orgId: v.id("organizations"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("emailLogs")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("sentAt"), args.since))
      .collect();

    return recent.length;
  },
});

// Send daily briefing email
export const sendDailyBriefing = action({
  args: {
    orgId: v.id("organizations"),
    ownerEmail: v.string(),
    summary: v.object({
      orderCount: v.number(),
      totalRevenue: v.number(),
      totalProfit: v.number(),
      lowStockItems: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const subject = `📊 Daily Briefing - ${org.name}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charSet="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0b0b0b; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #111827; color: white; padding: 16px; border-radius: 8px; }
            .content { background: #161616; padding: 16px; border-radius: 8px; margin-top: 8px; }
            .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
            .card { background: #0b0b0b; padding: 12px; border-radius: 6px; text-align: center; }
            .value { font-size: 18px; font-weight: 700; color: #fff; }
            .label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; }
            .alert { background: #1f2937; padding: 12px; border-radius: 6px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Daily Briefing</h1>
              <p style="margin: 6px 0 0 0; color: #9ca3af;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div class="content">
              <div class="grid">
                <div class="card"><div class="value">${args.summary.orderCount}</div><div class="label">Orders</div></div>
                <div class="card"><div class="value">$${args.summary.totalRevenue.toFixed(2)}</div><div class="label">Revenue</div></div>
                <div class="card"><div class="value">$${args.summary.totalProfit.toFixed(2)}</div><div class="label">Profit</div></div>
              </div>
              ${
                args.summary.lowStockItems.length > 0
                  ? `<div class="alert"><strong style="color:#fbbf24;">Low Stock</strong><ul style="margin:8px 0 0 0; padding-left:16px;">${args.summary.lowStockItems
                      .map((i) => `<li style="color:#f59e0b">${i}</li>`)
                      .join("")}</ul></div>`
                  : ""
              }
              <p style="margin-top: 16px;">Have a productive day!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: "notifications@whatthepack.today",
        to: args.ownerEmail,
        subject,
        html: htmlContent,
      });

      console.log("Email sent:", { orgId: args.orgId, email: args.ownerEmail, subject });

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },
});

// Send order failure notification
export const sendOrderFailure = action({
  args: {
    orgId: v.id("organizations"),
    orderNumber: v.string(),
    recipientEmails: v.array(v.string()),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const subject = `⚠️ Order Processing Failed - ${args.orderNumber}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">Order Processing Error</h2>
            <p><strong>Order Number:</strong> ${args.orderNumber}</p>
            <p><strong>Error:</strong> ${args.errorMessage}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p>Please review this order and take appropriate action.</p>
            <a href="https://${org.slug}.whatthepack.today/orders/${args.orderNumber}" 
               style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
              View Order
            </a>
          </div>
        </body>
      </html>
    `;

    try {
      for (const email of args.recipientEmails) {
        await resend.emails.send({
          from: "notifications@whatthepack.today",
          to: email,
          subject,
          html: htmlContent,
        });

        console.log("Email sent:", { orgId: args.orgId, email, subject });
      }

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },
});

// Generic email sending function for templates
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}) {
  try {
    const result = await resend.emails.send({
      from: "notifications@whatthepack.today",
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html || generateEmailHTML(options.template, options.data),
      text: options.text || generateEmailText(options.template, options.data),
    });

    return result;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
}

// Generate HTML email from template
function generateEmailHTML(template?: string, data?: Record<string, any>): string {
  if (!template || !data) {
    return `<div>${JSON.stringify(data || {})}</div>`;
  }

  switch (template) {
    case "staff-welcome":
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎉 Welcome to ${data.organizationName}!</h2>
          <p>Hi ${data.staffName},</p>
          <p>You've been invited to join <strong>${data.organizationName}</strong> as a <strong>${data.staffRole}</strong>.</p>
          <p>To complete your setup, please click the button below to create your password:</p>
          
          <a href="${data.setupLink}" style="background-color: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Complete Your Setup
          </a>
          
          <p>After setup, you can login at: <a href="${data.loginUrl}">${data.loginUrl}</a></p>
          
          <p>If you have any questions, contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
          
          <hr>
          <p style="color: #6b7280; font-size: 12px;">
            This invitation was sent by WhatThePack.today
          </p>
        </div>
      `;

    default:
      return `<div>${JSON.stringify(data, null, 2)}</div>`;
  }
}

// Generate plain text email from template
function generateEmailText(template?: string, data?: Record<string, any>): string {
  if (!template || !data) {
    return JSON.stringify(data || {});
  }

  switch (template) {
    case "staff-welcome":
      return `
Welcome to ${data.organizationName}!

Hi ${data.staffName},

You've been invited to join ${data.organizationName} as a ${data.staffRole}.

To complete your setup, visit this link:
${data.setupLink}

After setup, you can login at: ${data.loginUrl}

If you have any questions, contact us at ${data.supportEmail}

---
This invitation was sent by WhatThePack.today
      `;

    default:
      return JSON.stringify(data, null, 2);
  }
}
