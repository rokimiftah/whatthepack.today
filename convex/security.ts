// convex/security.ts - Security helper functions

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { internal } from "./_generated/api";
import { getUserRoles } from "./auth";

/**
 * Require that user has access to specific organization
 * Throws if user's orgId doesn't match requested orgId
 */
export async function requireOrgAccess(ctx: QueryCtx | MutationCtx | any, requestedOrgId: Id<"organizations">): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Get user's Auth0 org_id from JWT
  const customClaims = identity as any;
  const userAuth0OrgId = customClaims["https://whatthepack.today/orgId"];

  // Get the requested organization from Convex
  let org: any = null;
  if (ctx.db?.get) {
    org = await ctx.db.get(requestedOrgId);
  } else if (typeof ctx.runQuery === "function") {
    org = await ctx.runQuery(internal.organizations.get, { orgId: requestedOrgId });
  }
  if (!org) {
    throw new Error("Organization not found");
  }

  // Fallback for fresh tokens: allow if user owns or belongs to this org in DB
  if (!userAuth0OrgId) {
    // Owner check
    if (org.ownerAuth0Id === identity.subject) {
      return; // owner is allowed
    }
    // Membership check via users table
    if (ctx.db?.query) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
        .first();
      if (user?.orgId && user.orgId === requestedOrgId) {
        return; // linked to this org
      }
    } else if (typeof ctx.runQuery === "function") {
      const usersInOrg = await ctx.runQuery(internal.users.listByOrg, { orgId: requestedOrgId });
      const isMember = Array.isArray(usersInOrg) && usersInOrg.some((u: any) => u.auth0Id === identity.subject);
      if (isMember) return;
    }
    throw new Error("Access denied. No organization found in token. Please re-login.");
  }

  // Compare JWT's Auth0 org_id with any of the stored org ids (prod/dev/back-compat)
  const ok = [org.auth0OrgId, org.auth0OrgIdProd, org.auth0OrgIdDev].filter(Boolean).includes(userAuth0OrgId);
  if (!ok) {
    console.warn("[Security] Unauthorized org access attempt", {
      auth0Id: identity.subject,
      userAuth0OrgId,
      orgAuth0OrgId: org.auth0OrgId,
      orgAuth0OrgIdProd: (org as any).auth0OrgIdProd,
      orgAuth0OrgIdDev: (org as any).auth0OrgIdDev,
      requestedOrgId,
    });
    throw new Error("Unauthorized: Cannot access other organization's data");
  }
}

/**
 * Require that user has one of the specified roles
 * Throws if user doesn't have required role
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx | any,
  orgId: Id<"organizations">,
  allowedRoles: string[],
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // First verify org access
  await requireOrgAccess(ctx, orgId);

  // Then check role
  const roles = await getUserRoles(ctx);
  const hasRole = allowedRoles.some((role) => roles.includes(role));

  if (!hasRole) {
    console.warn("[Security] Insufficient permissions", {
      auth0Id: identity.subject,
      userRoles: roles,
      requiredRoles: allowedRoles,
      orgId,
    });
    throw new Error(`Insufficient permissions. Required: ${allowedRoles.join(" or ")}`);
  }
}

/**
 * Check if current environment is development
 */
export function isDevelopment(): boolean {
  // In Convex, check if deployment URL contains "localhost" or "dev"
  const convexUrl = process.env.CONVEX_SITE_URL || process.env.PUBLIC_CONVEX_URL || "";
  return convexUrl.includes("localhost") || convexUrl.includes("127.0.0.1") || process.env.NODE_ENV === "development";
}

/**
 * Validate that subdomain matches organization
 * CRITICAL: Prevents cross-tenant access
 */
export function validateSubdomain(userOrgSlug: string, requestedSubdomain: string | undefined): boolean {
  if (!requestedSubdomain) {
    return true; // No subdomain specified (platform domain)
  }

  // SECURITY: Dev subdomain only allowed in development
  if (requestedSubdomain === "dev") {
    if (!isDevelopment()) {
      console.error("[Security] BLOCKED: Dev subdomain access in production!", {
        userOrgSlug,
      });
      return false;
    }
    return true; // Allow dev in development only
  }

  // Must match user's organization
  if (userOrgSlug !== requestedSubdomain) {
    console.warn("[Security] Subdomain mismatch", {
      userOrgSlug,
      requestedSubdomain,
    });
    return false;
  }

  return true;
}

/**
 * Rate limiting helper (simple in-memory for now)
 * TODO: Implement proper distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Start a new window if none exists or the window has expired
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  // Enforce limit
  if (record.count >= maxRequests) {
    console.warn("[Security] Rate limit exceeded", { key, maxRequests });
    return false;
  }

  // Avoid mutating potentially frozen records by replacing the entry
  rateLimitStore.set(key, { count: record.count + 1, resetAt: record.resetAt });
  return true;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>"']/g, "") // Remove potential XSS chars
    .trim();
}

/**
 * Validate amount/price is valid
 */
export function validateAmount(amount: number): boolean {
  return (
    typeof amount === "number" && !Number.isNaN(amount) && Number.isFinite(amount) && amount >= 0 && amount <= 1000000 // Max amount: 1M
  );
}
