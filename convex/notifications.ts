// convex/notifications.ts - Persistent notification "seen" state per user/org
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireRole } from "./auth";

// Get current user's notification state for an org
export const getState = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { orgId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await requireRole(ctx, orgId, ["owner", "admin", "packer"]);

    // Resolve current user in Convex DB
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
      .first();
    if (!user?._id) throw new Error("User not found");

    const state = await ctx.db
      .query("notificationStates")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", user._id))
      .first();

    // Default: not seen yet
    return {
      lastSeenAt: state?.lastSeenAt ?? 0,
      hasSeen: typeof state?.lastSeenAt === "number" && state.lastSeenAt > 0,
    } as const;
  },
});

// Mark notifications as seen (set lastSeenAt = now)
export const markSeen = mutation({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { orgId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await requireRole(ctx, orgId, ["owner", "admin", "packer"]);

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
      .first();
    if (!user?._id) throw new Error("User not found");

    const existing = await ctx.db
      .query("notificationStates")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", user._id))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      return { updated: true } as const;
    }

    await ctx.db.insert("notificationStates", {
      orgId,
      userId: user._id,
      lastSeenAt: now,
    });
    return { created: true } as const;
  },
});
