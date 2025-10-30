// convex/users.ts

import type { Id } from "./_generated/dataModel";

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserOrgId, getUserRoles } from "./auth";

export const verifyEmail = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!user) {
      throw new ConvexError("User not found");
    }
    await ctx.db.patch(user._id, {
      emailVerificationTime: Date.now(),
    });
    return { success: true };
  },
});

export const getInternalUserByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    // Use take() instead of collect() to limit memory usage
    const accounts = await ctx.db.query("authAccounts").take(1000);
    const account = accounts.find((a) => (a as any).tokenIdentifier === tokenIdentifier);
    if (!account) return null;
    return await ctx.db.get(account.userId);
  },
});

export const getUserVerificationStatus = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?.emailVerificationTime !== undefined && user?.emailVerificationTime !== null;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const checkUserExists = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user !== null;
  },
});

export const checkUserProvider = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      return null;
    }
    // A user typically has 1-3 auth accounts, so take(10) is safe
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .take(10);
    const providers = accounts.map((account) => account.provider);
    return providers;
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    storageId: v.optional(v.string()),
  },
  handler: async (ctx, { name, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    let imageUrl: string | undefined;
    if (storageId) {
      const url = await ctx.storage.getUrl(storageId);
      imageUrl = url ?? undefined;
    }

    await ctx.db.patch(userId, {
      name: name,
      ...(imageUrl && { image: imageUrl, storageId }),
    });
  },
});

// Create user from Auth0 (internal - called by provisioning)
export const createFromAuth0 = mutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("packer")),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {};

      if (existing.email !== normalizedEmail) {
        updates.email = normalizedEmail;
      }

      if (existing.name !== args.name) {
        updates.name = args.name;
      }

      if (existing.role !== args.role) {
        updates.role = args.role;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      auth0Id: args.auth0Id,
      email: normalizedEmail,
      name: args.name,
      role: args.role,
    });

    return userId;
  },
});

// Update user organization (internal)
export const updateOrg = mutation({
  args: {
    userId: v.id("users"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { orgId: args.orgId });
  },
});

// Update user role (internal)
export const updateRole = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("packer")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// Deactivate user (internal)
export const deactivateUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // In a real implementation, you might have an isActive field
    // For now, we'll just clear the orgId
    await ctx.db.patch(args.userId, { orgId: undefined });
  },
});

// List users by organization (internal)
export const listByOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const ensureAuth0UserRecord = internalMutation({
  args: {
    auth0Id: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      auth0Id: args.auth0Id,
    });

    return userId;
  },
});

export const syncCurrentUser = mutation({
  args: {
    orgIdHint: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const identityAny = identity as Record<string, any>;
    const auth0Id = identity.subject;
    const normalizedEmail =
      typeof identity.email === "string" && identity.email
        ? identity.email.toLowerCase().trim()
        : typeof identityAny.email === "string"
          ? identityAny.email.toLowerCase().trim()
          : undefined;
    const displayName =
      typeof identity.name === "string" && identity.name.trim().length > 0
        ? identity.name.trim()
        : typeof identityAny.name === "string" && identityAny.name.trim().length > 0
          ? identityAny.name.trim()
          : undefined;

    const usernameClaim =
      typeof identityAny["https://whatthepack.today/username"] === "string" &&
      identityAny["https://whatthepack.today/username"].trim().length > 0
        ? identityAny["https://whatthepack.today/username"].trim()
        : typeof identityAny.nickname === "string" && identityAny.nickname.trim().length > 0
          ? identityAny.nickname.trim()
          : undefined;

    let primaryRole: "owner" | "admin" | "packer" | undefined;
    try {
      const roles = await getUserRoles(ctx);
      if (roles.includes("owner")) primaryRole = "owner";
      else if (roles.includes("admin")) primaryRole = "admin";
      else if (roles.includes("packer")) primaryRole = "packer";
    } catch (error) {
      console.warn("[syncCurrentUser] Failed to resolve roles", error);
    }

    let orgId: Id<"organizations"> | null = null;
    try {
      orgId = await getUserOrgId(ctx);
    } catch (error) {
      console.warn("[syncCurrentUser] Unable to resolve orgId from claims", error);
    }

    if (!orgId && args.orgIdHint) {
      orgId = args.orgIdHint;
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", auth0Id))
      .first();

    if (!user && normalizedEmail) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();
    }

    const emailVerified =
      identityAny.email_verified === true ||
      identityAny.emailVerified === true ||
      identityAny["https://auth0.com/email_verified"] === true;
    const now = Date.now();

    if (!user) {
      const insertedUserId = await ctx.db.insert("users", {
        auth0Id,
        email: normalizedEmail,
        name: displayName,
        username: usernameClaim,
        role: primaryRole,
        orgId: orgId ?? undefined,
        linkedProviders: ["auth0"],
        emailVerificationTime: emailVerified ? now : undefined,
      });

      return { created: true, updated: false, userId: insertedUserId };
    }

    const updates: Record<string, unknown> = {};

    if (normalizedEmail && user.email !== normalizedEmail) {
      updates.email = normalizedEmail;
    }
    if (!user.auth0Id || user.auth0Id !== auth0Id) {
      updates.auth0Id = auth0Id;
    }
    if (primaryRole && user.role !== primaryRole) {
      updates.role = primaryRole;
    }
    if (orgId && (!user.orgId || user.orgId !== orgId)) {
      updates.orgId = orgId;
    }
    if (displayName && user.name !== displayName) {
      updates.name = displayName;
    }
    if (usernameClaim && user.username !== usernameClaim) {
      updates.username = usernameClaim;
    }
    if (emailVerified && !user.emailVerificationTime) {
      updates.emailVerificationTime = now;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates);
      return { created: false, updated: true, userId: user._id };
    }

    return { created: false, updated: false, userId: user._id };
  },
});

export const upsertAuth0User = internalMutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    orgId: v.id("organizations"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("packer")),
    username: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    let user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();

    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();
    }

    const updates: Record<string, unknown> = {
      auth0Id: args.auth0Id,
      email: normalizedEmail,
      orgId: args.orgId,
      role: args.role,
    };

    if (args.username && args.username.trim().length > 0) {
      updates.username = args.username.trim();
    }
    if (args.name && args.name.trim().length > 0) {
      updates.name = args.name.trim();
    }

    if (user) {
      await ctx.db.patch(user._id, updates);
      return user._id;
    }

    const userId = await ctx.db.insert("users", {
      ...updates,
      linkedProviders: ["auth0"],
    });

    return userId;
  },
});
