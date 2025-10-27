// convex/invites.ts - Staff Invitation Management

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireRole } from "./auth";
import { requireOrgAccess } from "./security";

// Create invitation (owner only)
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    username: v.string(),
    role: v.union(v.literal("admin"), v.literal("packer")),
    invitedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx).catch(() => null);

    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    // Ensure inviter belongs to this org and resolve inviter userId
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const inviterUserId = args.invitedBy ?? currentUserId ?? org.ownerId; // prefer explicit, then current, else owner

    // Check if email already invited
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) {
      throw new Error("User already has a pending invitation");
    }

    // Check if user already exists in this org
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser?.orgId && existingUser.orgId !== args.orgId) {
      throw new Error("User belongs to a different organization");
    }

    const inviteId = await ctx.db.insert("invites", {
      orgId: args.orgId,
      email: args.email,
      username: args.username,
      role: args.role,
      status: "pending",
      invitedBy: inviterUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return inviteId;
  },
});

// List invitations for organization (owner only)
export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();

    return invites;
  },
});

// Get invitation by ID
export const get = query({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invitation not found");

    // SECURITY: Validate user has access to this invite's organization
    await requireOrgAccess(ctx, invite.orgId);
    await requireRole(ctx, invite.orgId, ["owner"]);

    return invite;
  },
});

// Update invitation status (internal - called by Auth0 webhook)
export const updateStatus = mutation({
  args: {
    inviteId: v.id("invites"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
    auth0UserId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invitation not found");

    const updates: any = {
      status: args.status,
    };

    if (args.status === "accepted") {
      updates.acceptedAt = Date.now();
    }

    if (args.auth0UserId) {
      updates.auth0UserId = args.auth0UserId;
    }

    if (args.ticketUrl) {
      updates.ticketUrl = args.ticketUrl;
    }

    await ctx.db.patch(args.inviteId, updates);
  },
});

// Cancel invitation (owner only)
export const cancel = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invitation not found");

    // SECURITY: Validate user has access to this invite's organization
    await requireOrgAccess(ctx, invite.orgId);
    await requireRole(ctx, invite.orgId, ["owner"]);

    if (invite.status !== "pending") {
      throw new Error("Can only cancel pending invitations");
    }

    await ctx.db.patch(args.inviteId, {
      status: "expired",
    });
  },
});

// Resend invitation (owner only)
export const resend = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invitation not found");

    // SECURITY: Validate user has access to this invite's organization
    await requireOrgAccess(ctx, invite.orgId);
    await requireRole(ctx, invite.orgId, ["owner"]);

    if (invite.status !== "pending") {
      throw new Error("Can only resend pending invitations");
    }

    // Extend expiration
    await ctx.db.patch(args.inviteId, {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return invite;
  },
});

// Get pending invitations count (owner only)
export const getPendingCount = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return invites.length;
  },
});

export const listForOrgInternal = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired"))),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    await requireRole(ctx, args.orgId, ["owner"]);

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (!args.status) {
      return invites;
    }

    return invites.filter((invite) => invite.status === args.status);
  },
});

export const expirePendingByEmail = internalMutation({
  args: { orgId: v.id("organizations"), email: v.string() },
  handler: async (ctx, args) => {
    const pendingInvites = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const invite of pendingInvites) {
      await ctx.db.patch(invite._id, { status: "expired" as const, expiresAt: Date.now() });
    }
  },
});
