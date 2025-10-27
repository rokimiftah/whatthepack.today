// convex/security.ts - Security helper functions

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { getUserOrgId, getUserRoles } from "./auth";

/**
 * Require that user has access to specific organization
 * Throws if user's orgId doesn't match requested orgId
 */
export async function requireOrgAccess(ctx: QueryCtx | MutationCtx, requestedOrgId: Id<"organizations">): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Get the requested organization from Convex
  const org = await ctx.db.get(requestedOrgId);
  if (!org) {
    throw new Error("Organization not found");
  }
  const customClaims = identity as any;
  const rawClaimOrgId = customClaims["https://whatthepack.today/orgId"];

  if (!rawClaimOrgId) {
    throw new Error("Access denied. No organization found in token. Please re-login.");
  }

  // Step 1: Resolve Convex orgId with helper (covers most cases and handles legacy tokens)
  let resolvedUserOrgId: Id<"organizations"> | null = null;
  try {
    resolvedUserOrgId = await getUserOrgId(ctx);
  } catch (error) {
    console.warn("[Security] Unable to resolve user org via helper", {
      auth0Id: identity.subject,
      requestedOrgId,
      error,
    });
  }

  if (resolvedUserOrgId) {
    if (resolvedUserOrgId !== requestedOrgId) {
      console.warn("[Security] Unauthorized org access attempt (resolved id mismatch)", {
        auth0Id: identity.subject,
        resolvedUserOrgId,
        requestedOrgId,
      });
      throw new Error("Unauthorized: Cannot access other organization's data");
    }
    return;
  }

  // Step 2: Handle claims that might already contain Convex orgId
  if (typeof rawClaimOrgId === "string" && !rawClaimOrgId.startsWith("org_")) {
    const normalizedOrgId =
      typeof ctx.db.normalizeId === "function" ? (ctx.db.normalizeId as any).call(ctx.db, "organizations", rawClaimOrgId) : null;

    if (normalizedOrgId) {
      if (normalizedOrgId !== requestedOrgId) {
        console.warn("[Security] Unauthorized org access attempt (normalized claim mismatch)", {
          auth0Id: identity.subject,
          claimOrgId: rawClaimOrgId,
          normalizedOrgId,
          requestedOrgId,
        });
        throw new Error("Unauthorized: Cannot access other organization's data");
      }
      return;
    }
  }

  // Step 3: Compare Auth0 org identifier when organization has mapping stored
  if (org.auth0OrgId && org.auth0OrgId === rawClaimOrgId) {
    return;
  }

  console.warn("[Security] Unauthorized org access attempt (final check)", {
    auth0Id: identity.subject,
    rawClaimOrgId,
    orgAuth0OrgId: org.auth0OrgId,
    requestedOrgId,
  });
  throw new Error("Unauthorized: Cannot access other organization's data");
}

/**
 * Require that user has one of the specified roles
 * Throws if user doesn't have required role
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
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
