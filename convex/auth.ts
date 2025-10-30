// convex/auth.ts

/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

import Auth0Provider from "@auth/core/providers/auth0";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { ResendMagicLink } from "./magicLink";

// Auth0 configuration
const Auth0 = Auth0Provider({
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET, // Optional for PKCE flow
  issuer: `https://${process.env.AUTH0_DOMAIN}`,
  authorization: {
    params: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: "openid email profile",
    },
  },
  allowDangerousEmailAccountLinking: true,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Auth0,
    ResendMagicLink,
    GitHub({
      allowDangerousEmailAccountLinking: true,
      profile: (params) => {
        if (typeof params.email !== "string") {
          throw new ConvexError("Email is required");
        }
        if (typeof params.id !== "string" && typeof params.id !== "number") {
          throw new ConvexError("GitHub user ID is required");
        }
        const normalizedEmail = params.email.toLowerCase().trim();
        const { error, data } = z
          .object({
            email: z.email("Invalid email address"),
          })
          .safeParse({ email: normalizedEmail });
        if (error) throw new ConvexError(error.issues[0].message);

        const raw: any = params;
        const image: string | undefined =
          typeof raw.avatar_url === "string" ? raw.avatar_url : typeof raw.picture === "string" ? raw.picture : undefined;

        const name: string | undefined =
          typeof raw.name === "string" && raw.name.trim() ? raw.name : typeof raw.login === "string" ? raw.login : undefined;

        return {
          id: String(params.id),
          email: data.email,
          ...(image ? { image } : {}),
          ...(name ? { name } : {}),
        };
      },
    }),
    Google({
      allowDangerousEmailAccountLinking: true,
      profile: (params) => {
        const raw: any = params;
        const id: string | undefined =
          typeof raw.id === "string"
            ? raw.id
            : typeof raw.id === "number"
              ? String(raw.id)
              : typeof raw.sub === "string"
                ? raw.sub
                : undefined;
        if (!id) {
          throw new ConvexError("Google user ID is required");
        }
        if (typeof raw.email !== "string") {
          throw new ConvexError("Email is required");
        }
        const normalizedEmail = raw.email.toLowerCase().trim();
        const { error, data } = z
          .object({
            email: z.email("Invalid email address"),
          })
          .safeParse({ email: normalizedEmail });
        if (error) throw new ConvexError(error.issues[0].message);

        const image: string | undefined =
          typeof raw.picture === "string" ? raw.picture : typeof raw.image === "string" ? raw.image : undefined;
        const name: string | undefined = typeof raw.name === "string" && raw.name.trim() ? raw.name : undefined;

        return {
          id,
          email: data.email,
          ...(image ? { image } : {}),
          ...(name ? { name } : {}),
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx: MutationCtx, args: any) {
      const normalizedEmail = args.profile.email.toLowerCase().trim();
      const provider = typeof args.provider?.id === "string" ? args.provider.id : args.type === "oauth" ? "oauth" : "magic-link";
      const profileAny = args.profile as Record<string, any>;
      const accountAny = (args as any).account as Record<string, any> | undefined;
      const auth0Id =
        provider === "auth0"
          ? typeof accountAny?.providerAccountId === "string"
            ? accountAny.providerAccountId
            : typeof profileAny?.sub === "string"
              ? profileAny.sub
              : typeof profileAny?.user_id === "string"
                ? profileAny.user_id
                : undefined
          : undefined;
      const usernameFromProfile =
        typeof profileAny?.nickname === "string" && profileAny.nickname.trim().length > 0
          ? profileAny.nickname.trim()
          : undefined;

      const existingUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();

      const image: string | undefined = typeof args.profile.image === "string" ? args.profile.image : undefined;
      const name: string | undefined =
        typeof args.profile.name === "string" && args.profile.name.trim() ? args.profile.name.trim() : undefined;

      if (existingUser) {
        const currentProviders = existingUser.linkedProviders || [];
        const updates: any = {};

        if (!currentProviders.includes(provider)) {
          updates.linkedProviders = [...currentProviders, provider];
        }
        if (args.type === "oauth" && !existingUser.emailVerificationTime) {
          updates.emailVerificationTime = Date.now();
        }
        if (image && !existingUser.image) {
          updates.image = image;
        }
        if (name && !existingUser.name) {
          updates.name = name;
        }
        if (auth0Id && existingUser.auth0Id !== auth0Id) {
          updates.auth0Id = auth0Id;
        }
        if (usernameFromProfile && existingUser.username !== usernameFromProfile) {
          updates.username = usernameFromProfile;
        }

        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existingUser._id, updates);
        }
        return existingUser._id;
      }

      const userId = await ctx.db.insert("users", {
        email: normalizedEmail,
        emailVerificationTime: args.type === "oauth" ? Date.now() : undefined,
        linkedProviders: [provider],
        ...(image ? { image } : {}),
        ...(name ? { name } : {}),
        ...(auth0Id ? { auth0Id } : {}),
        ...(usernameFromProfile ? { username: usernameFromProfile } : {}),
      });

      return userId;
    },
  },
});

// Helper function to require specific roles (for Auth0)
export const requireRole = async (ctx: any, orgId: any, allowedRoles: string[]) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Get custom claims from Auth0 JWT
  const customClaims = identity as any;
  const userRoles: string[] = customClaims["https://whatthepack.today/roles"] || [];
  const userAuth0OrgId: string = customClaims["https://whatthepack.today/orgId"];

  // Check if user has any of the allowed roles
  let hasRole = userRoles.some((role) => allowedRoles.includes(role));
  let fallbackOwner = false;
  let fallbackDbRole: string | undefined;

  if (!hasRole && allowedRoles.includes("owner")) {
    // Fallback: treat user as owner if DB says they are the owner of the requested org
    const org = ctx.db?.get
      ? await ctx.db.get(orgId)
      : typeof ctx.runQuery === "function"
        ? await ctx.runQuery(internal.organizations.get, { orgId })
        : null;
    if (org && org.ownerAuth0Id === identity.subject) {
      fallbackOwner = true;
      hasRole = true;
    }
  }

  if (!hasRole) {
    // DB fallback for admin/packer: trust Convex DB role when JWT roles are missing
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
        .first();
      if (user && user.orgId === orgId && allowedRoles.includes(user.role)) {
        hasRole = true;
        fallbackDbRole = user.role as string;
      }
    } catch {}
  }

  if (!hasRole) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}. User roles: ${userRoles.join(", ")}`);
  }

  // Verify user belongs to the organization (multi-tenancy isolation)
  // JWT now contains Auth0 org_id (org_xxxxx), but we receive Convex org_id
  // We need to fetch the Convex org and compare auth0OrgId

  if (!userAuth0OrgId && !fallbackOwner && !fallbackDbRole) {
    throw new Error("Access denied. No organization found in token. Please re-login.");
  }

  // Get the organization from Convex to check its auth0OrgId
  let org: any;
  if (ctx.db?.get) {
    org = await ctx.db.get(orgId);
  } else if (typeof ctx.runQuery === "function") {
    org = await ctx.runQuery(internal.organizations.get, { orgId });
  }
  if (!org) {
    throw new Error("Organization not found");
  }

  if (!fallbackOwner && !fallbackDbRole && userAuth0OrgId) {
    // If token has Auth0 org id, ensure it matches org's auth0OrgId if present
    if (org.auth0OrgId && org.auth0OrgId !== userAuth0OrgId) {
      console.error("[requireRole] Org mismatch:", {
        userAuth0OrgId,
        orgAuth0OrgId: org.auth0OrgId,
        convexOrgId: orgId,
      });
      throw new Error("Access denied. User does not belong to this organization");
    }
  } else if (!fallbackOwner && !fallbackDbRole && org.auth0OrgId && org.auth0OrgId !== userAuth0OrgId) {
    console.error("[requireRole] Org mismatch:", {
      userAuth0OrgId,
      orgAuth0OrgId: org.auth0OrgId,
      convexOrgId: orgId,
    });
    throw new Error("Access denied. User does not belong to this organization");
  }

  return fallbackOwner ? "owner" : fallbackDbRole || userRoles[0]; // Return primary role
};

// Helper to get user's organization ID from JWT
export const getUserOrgId = async (ctx: any): Promise<Id<"organizations">> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const customClaims = identity as any;
  const claimValue = customClaims["https://whatthepack.today/orgId"];

  if (!claimValue) {
    // Fallback: resolve org from DB by user linkage or ownership
    // 1) If user record has orgId, use it
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", (identity as any).subject))
        .first();
      if (user?.orgId) return user.orgId as Id<"organizations">;
    } catch {}
    // 2) If user is owner of any org, use that org
    try {
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_ownerAuth0Id", (q: any) => q.eq("ownerAuth0Id", (identity as any).subject))
        .first();
      if (org?._id) return org._id as Id<"organizations">;
    } catch {}
    throw new Error("Organization ID not found in token. User may not be assigned to an organization.");
  }

  // Backward compatibility: older tokens stored Convex orgId directly
  const normalize = typeof ctx.db?.normalizeId === "function" ? ctx.db.normalizeId.bind(ctx.db) : null;

  const isAuth0OrgId = typeof claimValue === "string" && claimValue.startsWith("org_");

  if (!isAuth0OrgId) {
    const normalizedId = normalize ? normalize("organizations", claimValue) : null;

    if (normalizedId) {
      const existing = ctx.db?.get
        ? await ctx.db.get(normalizedId)
        : typeof ctx.runQuery === "function"
          ? await ctx.runQuery(internal.organizations.get, { orgId: normalizedId })
          : null;
      if (existing) {
        return normalizedId;
      }
    }

    if (typeof ctx.runQuery === "function") {
      const org = await ctx.runQuery(internal.organizations.get, { orgId: claimValue as Id<"organizations"> });
      if (org) {
        return claimValue as Id<"organizations">;
      }
    }

    throw new Error("Organization not found for provided orgId claim. Please re-login.");
  }

  let organization: any;
  if (ctx.db?.query) {
    organization = await ctx.db
      .query("organizations")
      .withIndex("by_auth0OrgId", (q: any) => q.eq("auth0OrgId", claimValue))
      .first();
  } else if (typeof ctx.runQuery === "function") {
    organization = await ctx.runQuery(internal.organizations.getByAuth0OrgId, { auth0OrgId: claimValue });
  }

  if (!organization) {
    throw new Error("Organization not found for provided orgId claim. Please re-login.");
  }

  return organization._id as Id<"organizations">;
};

// Helper to get user's roles from JWT
export const getUserRoles = async (ctx: any): Promise<string[]> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const customClaims = identity as any;
  let roles: string[] = customClaims["https://whatthepack.today/roles"] || [];

  // Safety: Only treat user as 'owner' if they are actually the owner of the org in Convex
  if (roles.includes("owner")) {
    try {
      const orgId = await getUserOrgId(ctx);
      const org = ctx.db?.get
        ? await ctx.db.get(orgId)
        : typeof ctx.runQuery === "function"
          ? await ctx.runQuery(internal.organizations.get, { orgId })
          : null;
      const isRealOwner = org && org.ownerAuth0Id === identity.subject;
      if (!isRealOwner) {
        roles = roles.filter((r: string) => r !== "owner");
      }
    } catch (_e) {
      // If org cannot be resolved, do not erroneously assign owner
      roles = roles.filter((r: string) => r !== "owner");
    }
  }

  return roles;
};

export const getSessionMetadata = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { authenticated: false as const };
    }

    const claims = identity as any;
    const roles = Array.isArray(claims["https://whatthepack.today/roles"])
      ? (claims["https://whatthepack.today/roles"] as string[])
      : [];
    const orgId =
      typeof claims["https://whatthepack.today/orgId"] === "string"
        ? (claims["https://whatthepack.today/orgId"] as string)
        : null;

    const mfaClaimCandidates = [
      claims["https://whatthepack.today/mfa_enrolled"],
      claims["https://whatthepack.today/mfa"],
      claims["https://auth0.com/claims/mfa_enrolled"],
      claims["https://auth0.com/claims/mfa_authenticated"],
      claims["https://auth0.com/mfa"],
    ];

    const mfaEnrolled = mfaClaimCandidates.some((value) => value === true || value === "true" || value === 1);

    return {
      authenticated: true as const,
      roles,
      orgId,
      mfaEnrolled,
    };
  },
});
