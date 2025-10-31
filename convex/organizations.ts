// convex/organizations.ts - Organization Management

import type { Id } from "./_generated/dataModel";

import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserOrgId, getUserRoles, requireRole } from "./auth";

const RESERVED_SLUGS = new Set(["www", "app", "dev"]);

// Internal helper to fetch organization without requiring auth context
export const get = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orgId);
  },
});

export const getByAuth0OrgId = internalQuery({
  args: { auth0OrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_auth0OrgId", (q) => q.eq("auth0OrgId", args.auth0OrgId))
      .first();
  },
});

export const getByAuth0OrgIdProd = internalQuery({
  args: { auth0OrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_auth0OrgIdProd", (q) => q.eq("auth0OrgIdProd", args.auth0OrgId))
      .first();
  },
});

export const getByAuth0OrgIdDev = internalQuery({
  args: { auth0OrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_auth0OrgIdDev", (q) => q.eq("auth0OrgIdDev", args.auth0OrgId))
      .first();
  },
});

// Internal mutation to update Auth0 org ID
export const updateAuth0OrgId = internalMutation({
  args: {
    orgId: v.id("organizations"),
    auth0OrgId: v.string(),
  },
  handler: async (ctx, args) => {
    // Always keep back-compat field updated
    const updates: any = { auth0OrgId: args.auth0OrgId, updatedAt: Date.now() };

    // Detect env by APP_DOMAIN_SUFFIX (".dev.whatthepack.today" => dev)
    const suffix = (process.env.APP_DOMAIN_SUFFIX || "").trim();
    const isDev = suffix.includes(".dev.") || suffix === ".dev.whatthepack.today";

    if (isDev) {
      updates.auth0OrgIdDev = args.auth0OrgId;
    } else {
      updates.auth0OrgIdProd = args.auth0OrgId;
    }

    await ctx.db.patch(args.orgId, updates);
  },
});

export const setVapiAssistantId = internalMutation({
  args: {
    orgId: v.id("organizations"),
    assistantId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      vapiAssistantId: args.assistantId,
      updatedAt: Date.now(),
    });
  },
});

// Create new organization (called during owner signup)
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    ownerAuth0Id: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if slug is already taken
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error(`Organization slug "${args.slug}" is already taken`);
    }
    if (RESERVED_SLUGS.has(args.slug)) {
      throw new Error(`Organization slug "${args.slug}" is reserved`);
    }

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      ownerId: args.ownerId,
      ownerAuth0Id: args.ownerAuth0Id,
      onboardingCompleted: false,
      shipEngineConnected: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });

    return orgId;
  },
});

// Get organization by slug (public - for subdomain routing)
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get organization for current authenticated user
// IMPORTANT: Also validates that current subdomain matches user's organization
export const getForCurrentUser = query({
  args: {
    expectedSlug: v.optional(v.string()), // Subdomain from URL
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const roles = await getUserRoles(ctx);
    const auth0Id = identity.subject;

    // Try to get orgId from JWT token first
    let orgIdFromToken: Id<"organizations"> | null = null;
    try {
      orgIdFromToken = await getUserOrgId(ctx);
    } catch (_error) {
      console.warn("[getForCurrentUser] No orgId in JWT, will query by auth0Id");
    }

    let org = null;

    // If JWT has orgId, use it
    if (orgIdFromToken) {
      org = await ctx.db.get(orgIdFromToken);
    }

    // FALLBACK: If no org from JWT, query by auth0Id (for fresh signups before JWT refresh)
    if (!org) {
      console.log("[getForCurrentUser] Querying org by auth0Id:", auth0Id);

      // Find user by auth0Id
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q) => q.eq("auth0Id", auth0Id))
        .first();

      if (user?.orgId) {
        org = await ctx.db.get(user.orgId);
        console.log("[getForCurrentUser] Found org via user lookup:", org?._id);
      }
    }

    if (!org) {
      console.log("[getForCurrentUser] No organization found for user");
      return null;
    }

    // SECURITY: Validate subdomain matches organization slug
    if (args.expectedSlug) {
      const isDevSubdomain = args.expectedSlug === "dev";
      const isDevelopment = process.env.CONVEX_SITE_URL?.includes("localhost") || process.env.NODE_ENV === "development";

      // CRITICAL: Block dev subdomain in production!
      if (isDevSubdomain && !isDevelopment) {
        console.error("[getForCurrentUser] SECURITY: Dev subdomain blocked in production!", {
          userOrg: org.slug,
          auth0Id,
        });
        return null;
      }

      // During onboarding, allow subdomain mismatch (user is setting up their slug)
      // After onboarding, enforce strict subdomain matching
      const isOnboarding = !org.onboardingCompleted;

      if (!isDevSubdomain && org.slug !== args.expectedSlug && !isOnboarding) {
        console.warn("[getForCurrentUser] SECURITY: Subdomain mismatch!", {
          userOrg: org.slug,
          requestedSubdomain: args.expectedSlug,
          auth0Id,
          onboardingCompleted: org.onboardingCompleted,
        });
        return null;
      }
    }

    // FALLBACK: If JWT doesn't have roles but user is the owner of this org, add owner role
    // This handles cases where:
    // 1. Fresh signup - role assigned in Auth0 but JWT not refreshed yet
    // 2. Post-Login Action not deployed/enabled
    // 3. Custom claims namespace mismatch
    const isActualOwner = org.ownerAuth0Id === auth0Id;
    const effectiveRoles = [...roles];

    if (isActualOwner && !effectiveRoles.includes("owner")) {
      console.log("[getForCurrentUser] Adding owner role via fallback (JWT missing role)", {
        auth0Id,
        orgId: org._id,
      });
      effectiveRoles.push("owner");
    }

    // DB fallback for admin/packer: if JWT lacks roles, but Convex user record has a role for this org, include it
    if (!effectiveRoles.length || (!effectiveRoles.includes("admin") && !effectiveRoles.includes("packer"))) {
      try {
        const user = await ctx.db
          .query("users")
          .withIndex("by_auth0Id", (q) => q.eq("auth0Id", auth0Id))
          .first();
        if (user?.orgId === org._id && (user.role === "admin" || user.role === "packer")) {
          if (!effectiveRoles.includes(user.role)) effectiveRoles.push(user.role);
        }
      } catch (_e) {
        // best-effort
      }
    }

    return {
      organization: org,
      roles: effectiveRoles,
      isOwner: effectiveRoles.includes("owner"),
    };
  },
});

// Get organization by ID
export const getById = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify user belongs to this org
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);

    return await ctx.db.get(args.orgId);
  },
});

// Update organization settings (owner only)
export const update = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    shipEngineConnected: v.optional(v.boolean()),
    onboardingCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner"]);

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.shipEngineConnected !== undefined) {
      updates.shipEngineConnected = args.shipEngineConnected;
      updates.shipEngineConfiguredAt = Date.now();
    }
    if (args.onboardingCompleted !== undefined) {
      updates.onboardingCompleted = args.onboardingCompleted;
    }

    await ctx.db.patch(args.orgId, updates);
  },
});

// Set or update slug (owner only)
export const setSlug = mutation({
  args: {
    orgId: v.id("organizations"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner"]);

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(args.slug)) {
      throw new Error("Slug must contain only lowercase letters, numbers, and hyphens");
    }
    if (RESERVED_SLUGS.has(args.slug)) {
      throw new Error("Slug is reserved by the platform");
    }

    // Check if new slug is already taken
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing && existing._id !== args.orgId) {
      throw new Error(`Slug "${args.slug}" is already taken`);
    }

    await ctx.db.patch(args.orgId, {
      slug: args.slug,
      updatedAt: Date.now(),
    });
  },
});

// Check slug availability for owner onboarding
export const checkSlugAvailability = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const candidate = args.slug.toLowerCase().trim();
    const slugRegex = /^[a-z0-9-]+$/;
    if (!candidate || !slugRegex.test(candidate)) {
      return { available: false, reason: "invalid_format" as const };
    }
    if (RESERVED_SLUGS.has(candidate)) {
      return { available: false, reason: "reserved" as const };
    }

    const roles = await getUserRoles(ctx);
    let currentOrgId: Id<"organizations"> | null = null;

    try {
      currentOrgId = await getUserOrgId(ctx);
    } catch (error) {
      console.warn("checkSlugAvailability: missing orgId claim", error);
    }

    // Allow slug checking if:
    // 1. User has owner role (normal case)
    // 2. User doesn't have an org yet (initial onboarding after signup)
    const hasOwnerRole = roles.includes("owner");
    const hasNoOrg = !currentOrgId;

    if (!hasOwnerRole && !hasNoOrg) {
      throw new Error("Only organization owners can check slug availability");
    }

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();

    if (!existing) {
      return { available: true, reason: "available" as const };
    }

    if (currentOrgId && existing._id === currentOrgId) {
      return { available: true, reason: "current" as const };
    }

    // Fresh signup case: org was just created for this user, but JWT doesn't have orgId yet.
    // Treat an org owned by the current Auth0 user as "current" to avoid false "taken" during onboarding.
    if (existing.ownerAuth0Id === identity.subject) {
      return { available: true, reason: "current" as const };
    }

    return { available: false, reason: "taken" as const };
  },
});

// List all organizations (internal - for admin purposes)
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

// Get organization by owner Auth0 ID
export const getByOwnerAuth0Id = internalQuery({
  args: { auth0Id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_ownerAuth0Id", (q) => q.eq("ownerAuth0Id", args.auth0Id))
      .first();
  },
});

// Check if organization has ShipEngine configured
export const hasShipEngine = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner", "admin", "packer"]);

    const org = await ctx.db.get(args.orgId);
    return org?.shipEngineConnected ?? false;
  },
});
