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
    const subject = `You're Invited to ${org.name} on What The Pack`;
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
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #e5e7eb;
        background: #0b0b0b;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: #7f1d1d;
        color: white;
        padding: 16px;
        border-radius: 8px;
      }
      .content {
        background: #161616;
        padding: 16px;
        border-radius: 8px;
        margin-top: 8px;
      }
      .button {
        display: inline-block;
        background: #e5e7eb;
        color: #111827;
        padding: 10px 16px;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 12px;
        font-weight: 600;
      }
      .footer {
        text-align: center;
        color: #9ca3af;
        font-size: 12px;
        margin-top: 16px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0">CRITICAL STOCK ALERT</h1>
        <p style="margin: 4px 0 0 0; opacity: 0.85">${org.name}</p>
      </div>
      <div class="content">
        <p><strong>Product:</strong> ${args.productName} (${args.productSku})</p>
        <p><strong>Current Stock:</strong> ${args.currentStock}</p>
        <p><strong>Reported By:</strong> ${args.reportedBy}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <a class="button" href="https://${org.slug}.whatthepack.today/inventory">View Inventory</a>
      </div>
      <p class="footer">This is an automated notification from What The Pack</p>
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
      This is an automated notification from What The Pack
    `.trim();

    try {
      // Send to all recipients
      for (const email of args.recipientEmails) {
        await resend.emails.send({
          from: "What The Pack <notifications@whatthepack.today>",
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
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #e5e7eb;
        background: #0b0b0b;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: #111827;
        color: white;
        padding: 16px;
        border-radius: 8px;
      }
      .content {
        background: #161616;
        padding: 16px;
        border-radius: 8px;
        margin-top: 8px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .card {
        background: #0b0b0b;
        padding: 12px;
        border-radius: 6px;
        text-align: center;
      }
      .value {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
      }
      .label {
        font-size: 11px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #9ca3af;
      }
      .alert {
        background: #1f2937;
        padding: 12px;
        border-radius: 6px;
        margin-top: 12px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0">Daily Briefing</h1>
        <p style="margin: 6px 0 0 0; color: #9ca3af">
          ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
      <div class="content">
        <div class="grid">
          <div class="card">
            <div class="value">${args.summary.orderCount}</div>
            <div class="label">Orders</div>
          </div>
          <div class="card">
            <div class="value">$${args.summary.totalRevenue.toFixed(2)}</div>
            <div class="label">Revenue</div>
          </div>
          <div class="card">
            <div class="value">$${args.summary.totalProfit.toFixed(2)}</div>
            <div class="label">Profit</div>
          </div>
        </div>
        ${
          args.summary.lowStockItems.length > 0
            ? `
        <div class="alert">
          <strong style="color: #fbbf24">Low Stock</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 16px">
            ${args.summary.lowStockItems
              .map(
                (i) => `
            <li style="color: #f59e0b">${i}</li>
            `,
              )
              .join("")}
          </ul>
        </div>
        `
            : ""
        }
        <p style="margin-top: 16px">Have a productive day!</p>
      </div>
    </div>
  </body>
</html>
    `;

    try {
      await resend.emails.send({
        from: "What The Pack <notifications@whatthepack.today>",
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
<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px">
      <h2 style="color: #dc2626">Order Processing Error</h2>
      <p><strong>Order Number:</strong> ${args.orderNumber}</p>
      <p><strong>Error:</strong> ${args.errorMessage}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p>Please review this order and take appropriate action.</p>
      <a
        href="https://${org.slug}.whatthepack.today/orders/${args.orderNumber}"
        style="
          display: inline-block;
          background: #1f2937;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 16px;
        "
      >
        View Order
      </a>
    </div>
  </body>
</html>

    `;

    try {
      for (const email of args.recipientEmails) {
        await resend.emails.send({
          from: "What The Pack <notifications@whatthepack.today>",
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
      from: "What The Pack <notifications@whatthepack.today>",
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
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>You're invited — ${data.organizationName}</title>
    <style>
      .preheader {
        display: none !important;
        visibility: hidden;
        opacity: 0;
        color: transparent;
        height: 0;
        width: 0;
        overflow: hidden;
      }
    </style>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background: #f6f7fb;
      font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Arial, sans-serif;
    "
  >
    <span class="preheader">You're invited to join ${data.organizationName} as a ${data.staffRole} on What The Pack</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse">
      <tr>
        <td align="center" style="padding: 24px">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="max-width: 600px; border: 1px solid #e8eaf0; border-radius: 12px; background: #ffffff"
          >
            <tr>
              <td style="padding: 28px">
                <!-- Header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 10px 0">
                  <tr>
                    <td style="vertical-align: middle">
                      <div style="font-size: 12px; letter-spacing: 0.08em; color: #667085; text-transform: uppercase">
                        What The Pack
                      </div>
                    </td>
                    <td align="right" style="vertical-align: middle">
                      <a href="mailto:${data.supportEmail}" style="font-size: 12px; color: #98a2b3; text-decoration: none"
                        >${data.supportEmail}</a
                      >
                    </td>
                  </tr>
                </table>

                <!-- Greeting & Title -->
                <p style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.6; color: #334155">Hi ${data.staffName},</p>
                <h1 style="margin: 8px 0 12px 0; font-size: 20px; line-height: 1.3; color: #111827">
                  You're invited to join ${data.organizationName}
                </h1>
                <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.7; color: #334155">
                  You've been invited to join What The Pack as a <strong style="color: #111827">${data.staffRole}</strong>. To get
                  started, set your password using the button below.
                </p>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0 10px">
                  <tr>
                    <td align="left">
                      <a
                        href="${data.setupLink}"
                        style="
                          background: #111827;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 12px 20px;
                          border-radius: 6px;
                          display: inline-block;
                          font-weight: 600;
                        "
                      >
                        Set Your Password
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback link -->
                <p style="margin: 8px 0 8px 0; font-size: 12px; color: #64748b">
                  If the button doesn't work, copy and paste this URL:
                </p>
                <div
                  style="
                    font-size: 12px;
                    color: #0f172a;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px;
                    word-break: break-all;
                    margin: 0 0 16px 0;
                  "
                >
                  <a href="${data.setupLink}" style="color: #0f172a; text-decoration: underline">${data.setupLink}</a>
                </div>

                <!-- After setup -->
                <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.7; color: #334155">After setup, sign in here:</p>
                <div
                  style="
                    font-size: 12px;
                    color: #0f172a;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px;
                    word-break: break-all;
                    margin: 0 0 16px 0;
                  "
                >
                  <a href="${data.loginUrl}" style="color: #0f172a; text-decoration: underline">${data.loginUrl}</a>
                </div>

                <!-- Footer note -->
                <p style="margin: 16px 0 0 0; font-size: 12px; line-height: 1.6; color: #64748b">
                  If you didn’t expect this invitation, you can safely ignore this email or contact us at
                  <a href="mailto:${data.supportEmail}" style="color: #64748b; text-decoration: underline">${data.supportEmail}</a
                  >.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
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
        You're invited to join ${data.organizationName}

        Hi ${data.staffName},

        You've been invited to join What The Pack as a ${data.staffRole}.

        Set your password using this link:
        ${data.setupLink}

        After setup, sign in here:
        ${data.loginUrl}

        If you didn't expect this invitation, ignore this email or contact ${data.supportEmail}.
      `;

    default:
      return JSON.stringify(data, null, 2);
  }
}
