// convex/schema.ts - WhatThePack Multi-Tenant Schema

import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Status types
const orderStatus = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("processing"),
  v.literal("shipped"),
  v.literal("delivered"),
  v.literal("cancelled"),
);

const inviteStatus = v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired"));

const roleType = v.union(v.literal("owner"), v.literal("admin"), v.literal("packer"));

export default defineSchema({
  ...authTables,

  // Extended users table with role and organization
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    linkedProviders: v.optional(v.array(v.string())),
    storageId: v.optional(v.string()),
    // WhatThePack specific fields
    auth0Id: v.optional(v.string()), // Auth0 user_id
    orgId: v.optional(v.id("organizations")), // Primary organization
    role: v.optional(roleType), // User role
    username: v.optional(v.string()), // e.g., lisa_admin
  })
    .index("email", ["email"])
    .index("by_auth0Id", ["auth0Id"])
    .index("by_org", ["orgId"])
    .index("by_org_role", ["orgId", "role"]),

  // Organizations (Multi-Tenant Core)
  organizations: defineTable({
    name: v.string(), // Business name
    slug: v.string(), // Subdomain slug (e.g., "store-name")
    ownerId: v.id("users"), // Owner user reference
    ownerAuth0Id: v.string(), // Auth0 user_id of owner
    // Auth0 org IDs per environment (support dev/prod tenants)
    auth0OrgId: v.optional(v.string()), // Back-compat default
    auth0OrgIdProd: v.optional(v.string()),
    auth0OrgIdDev: v.optional(v.string()),
    vapiAssistantId: v.optional(v.string()), // Cached Vapi assistant identifier
    onboardingCompleted: v.boolean(), // Owner finished initial setup
    // Integration settings
    shipEngineConnected: v.boolean(),
    shipEngineConfiguredAt: v.optional(v.number()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_ownerAuth0Id", ["ownerAuth0Id"])
    .index("by_auth0OrgId", ["auth0OrgId"])
    .index("by_auth0OrgIdProd", ["auth0OrgIdProd"])
    .index("by_auth0OrgIdDev", ["auth0OrgIdDev"]),

  // Products/Inventory
  products: defineTable({
    orgId: v.id("organizations"),
    // Product info
    sku: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    // Pricing (owner-only visibility)
    costOfGoods: v.number(), // COGS
    sellPrice: v.number(),
    profitMargin: v.number(), // Auto-calculated
    // Inventory
    stockQuantity: v.number(),
    warehouseLocation: v.string(), // Bin location
    // Packing instructions (packer visibility)
    sop_packing: v.optional(v.string()), // Standard Operating Procedure
    // Dimensions & weight
    weight: v.optional(v.number()), // in grams
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_orgId", ["orgId"])
    .index("by_org_sku", ["orgId", "sku"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["orgId", "sku"],
    }),

  // Orders
  orders: defineTable({
    orgId: v.id("organizations"),
    orderNumber: v.string(), // Human-readable order number
    status: orderStatus,
    // Customer info
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    // Shipping address
    recipientName: v.string(),
    recipientPhone: v.string(),
    recipientAddress: v.string(),
    recipientCity: v.string(),
    recipientProvince: v.string(),
    recipientPostalCode: v.string(),
    recipientCountry: v.string(),
    // Order items (array of product references)
    items: v.array(
      v.object({
        productId: v.id("products"),
        sku: v.string(),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        unitCost: v.number(),
      }),
    ),
    // Financial (owner-only)
    totalCost: v.number(), // Total COGS
    totalPrice: v.number(), // Total sell price
    totalProfit: v.number(),
    // Shipping
    weight: v.optional(v.number()), // Actual weight (set by packer)
    shippingCost: v.optional(v.number()),
    trackingNumber: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    courierService: v.optional(v.string()),
    // Chat extraction
    rawChatLog: v.optional(v.string()), // Original chat paste
    // Workflow tracking
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
    shippedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    // User tracking
    createdBy: v.id("users"), // Admin who created order
    packedBy: v.optional(v.id("users")), // Packer who processed
    // Notes
    notes: v.optional(v.string()),
    specialInstructions: v.optional(v.string()), // Customer special instructions
  })
    .index("by_orgId", ["orgId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_orderNumber", ["orderNumber"]),

  // Stock Movements (Audit Trail)
  movements: defineTable({
    orgId: v.id("organizations"),
    productId: v.id("products"),
    sku: v.string(),
    // Movement details
    type: v.union(
      v.literal("order_created"), // Stock reserved
      v.literal("order_shipped"), // Stock deducted
      v.literal("order_cancelled"), // Stock restored
      v.literal("stock_adjustment"), // Manual adjustment
      v.literal("stock_in"), // Restocking
    ),
    quantityBefore: v.number(),
    quantityChange: v.number(), // Positive or negative
    quantityAfter: v.number(),
    // References
    orderId: v.optional(v.id("orders")),
    userId: v.id("users"),
    // Metadata
    createdAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_product", ["productId"])
    .index("by_org_created", ["orgId", "createdAt"]),

  // Staff Invitations
  invites: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: roleType,
    status: inviteStatus,
    // Auth0 references
    auth0UserId: v.optional(v.string()), // Set when user created
    ticketUrl: v.optional(v.string()), // Password change ticket URL
    // Metadata
    invitedBy: v.id("users"), // Owner who sent invite
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  // Email Notifications Log
  emailLogs: defineTable({
    orgId: v.id("organizations"),
    recipientEmail: v.string(),
    recipientRole: v.optional(roleType),
    // Email details
    subject: v.string(),
    template: v.string(), // e.g., "stock-alert", "daily-briefing"
    // Related entities
    productId: v.optional(v.id("products")),
    orderId: v.optional(v.id("orders")),
    // Metadata
    sentAt: v.number(),
    resendId: v.optional(v.string()), // Resend API response ID
  })
    .index("by_orgId", ["orgId"])
    .index("by_template", ["template"])
    .index("by_sent", ["sentAt"]),

  // In‑app notification state per user (persistent "seen" status)
  notificationStates: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    lastSeenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  // VAPI Session Logs (for debugging voice interactions)
  vapiSessions: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    callId: v.string(),
    intent: v.string(), // e.g., "get_next_order", "complete_order"
    // Request/Response
    requestPayload: v.optional(v.string()), // JSON string
    responsePayload: v.optional(v.string()), // JSON string
    // Metadata
    createdAt: v.number(),
    duration: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_callId", ["callId"]),
});
