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

  // Resolve roles with safety fallbacks (ensures owners without claims are covered)
  const userRoles = await getUserRoles(ctx);

  // Get custom claims from Auth0 JWT
  const customClaims = identity as any;
  const userAuth0OrgId: string | undefined = customClaims["https://whatthepack.today/orgId"];

  // Check if user has any of the allowed roles
  const hasRole = allowedRoles.some((role) => userRoles.includes(role));
  if (!hasRole) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}. User roles: ${userRoles.join(", ")}`);
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

  let resolvedOrgId: Id<"organizations"> | null = null;
  try {
    resolvedOrgId = await getUserOrgId(ctx);
  } catch (error) {
    console.warn("[requireRole] Unable to resolve user org via helper", {
      auth0Id: identity.subject,
      requestedOrgId: orgId,
      error,
    });
  }

  const normalizedClaimOrgId =
    userAuth0OrgId && typeof ctx.db?.normalizeId === "function"
      ? ctx.db.normalizeId("organizations", userAuth0OrgId)
      : null;

  if (normalizedClaimOrgId && normalizedClaimOrgId !== orgId) {
    console.error("[requireRole] Claim orgId does not match requested orgId", {
      auth0Id: identity.subject,
      claim: userAuth0OrgId,
      normalizedClaimOrgId,
      requestedOrgId: orgId,
    });
    throw new Error("Access denied. User is not a member of this organization");
  }

  if (!resolvedOrgId && normalizedClaimOrgId) {
    resolvedOrgId = normalizedClaimOrgId;
  }

  if (!resolvedOrgId && userAuth0OrgId && org.auth0OrgId && org.auth0OrgId === userAuth0OrgId) {
    resolvedOrgId = org._id;
  }

  if (!resolvedOrgId) {
    throw new Error("Access denied. Unable to determine organization membership. Please re-login.");
  }

  if (resolvedOrgId !== orgId) {
    console.error("[requireRole] Resolved org does not match requested org", {
      auth0Id: identity.subject,
      resolvedOrgId,
      requestedOrgId: orgId,
    });
    throw new Error("Access denied. User is not a member of this organization");
  }

  if (userAuth0OrgId && org.auth0OrgId && org.auth0OrgId !== userAuth0OrgId) {
    console.error("[requireRole] Org mismatch", {
      auth0Id: identity.subject,
      userAuth0OrgId,
      orgAuth0OrgId: org.auth0OrgId,
      convexOrgId: orgId,
    });
    throw new Error("Access denied. User does not belong to this organization");
  }

  return userRoles[0]; // Return primary role
};

// Helper to get user's organization ID from JWT
export const getUserOrgId = async (ctx: any): Promise<Id<"organizations">> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const customClaims = identity as any;
  const claimValue = customClaims["https://whatthepack.today/orgId"];

  const fetchOrgById = async (orgId: Id<"organizations">) => {
    if (ctx.db?.get) {
      return await ctx.db.get(orgId);
    }
    if (typeof ctx.runQuery === "function") {
      return await ctx.runQuery(internal.organizations.get, { orgId });
    }
    return null;
  };

  const fetchOrgByAuth0Id = async (auth0OrgId: string) => {
    if (ctx.db?.query) {
      return await ctx.db
        .query("organizations")
        .withIndex("by_auth0OrgId", (q: any) => q.eq("auth0OrgId", auth0OrgId))
        .first();
    }
    if (typeof ctx.runQuery === "function") {
      return await ctx.runQuery(internal.organizations.getByAuth0OrgId, { auth0OrgId });
    }
    return null;
  };

  const fetchOrgByOwner = async () => {
    if (ctx.db?.query) {
      return await ctx.db
        .query("organizations")
        .withIndex("by_ownerAuth0Id", (q: any) => q.eq("ownerAuth0Id", identity.subject))
        .first();
    }
    if (typeof ctx.runQuery === "function") {
      return await ctx.runQuery(internal.organizations.getByOwnerAuth0Id, { auth0Id: identity.subject });
    }
    return null;
  };

  const fetchUserByAuth0Id = async () => {
    if (ctx.db?.query) {
      return await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
        .first();
    }
    if (typeof ctx.runQuery === "function") {
      return await ctx.runQuery(internal.users.getByAuth0Id, { auth0Id: identity.subject });
    }
    return null;
  };

  if (claimValue) {
    const normalize = typeof ctx.db?.normalizeId === "function" ? ctx.db.normalizeId.bind(ctx.db) : null;

    if (normalize && typeof claimValue === "string") {
      try {
        const normalized = normalize("organizations", claimValue);
        if (normalized) {
          const existing = await fetchOrgById(normalized);
          if (existing) {
            return normalized;
          }
        }
      } catch (_error) {
        // ignore normalization failure, fall through to other strategies
      }
    }

    if (typeof claimValue === "string" && !claimValue.startsWith("org_")) {
      const existing = await fetchOrgById(claimValue as Id<"organizations">);
      if (existing) {
        return claimValue as Id<"organizations">;
      }
    }

    if (typeof claimValue === "string" && claimValue.startsWith("org_")) {
      const organization = await fetchOrgByAuth0Id(claimValue);
      if (organization) {
        return organization._id as Id<"organizations">;
      }
    }
  }

  const ownerOrg = await fetchOrgByOwner();
  if (ownerOrg) {
    return ownerOrg._id as Id<"organizations">;
  }

  const userRecord = await fetchUserByAuth0Id();
  if (userRecord?.orgId) {
    return userRecord.orgId as Id<"organizations">;
  }

  throw new Error("Organization ID not found in token. User may not be assigned to an organization.");
};

// Helper to get user's roles from JWT
export const getUserRoles = async (ctx: any): Promise<string[]> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const customClaims = identity as any;
  let roles: string[] = customClaims["https://whatthepack.today/roles"] || [];

  let resolvedOrgId: Id<"organizations"> | null = null;
  let organization: any = null;

  try {
    resolvedOrgId = await getUserOrgId(ctx);
  } catch (error) {
    console.warn("[getUserRoles] Unable to resolve org via helper", {
      auth0Id: identity.subject,
      error,
    });
  }

  if (resolvedOrgId) {
    organization = ctx.db?.get
      ? await ctx.db.get(resolvedOrgId)
      : typeof ctx.runQuery === "function"
        ? await ctx.runQuery(internal.organizations.get, { orgId: resolvedOrgId })
        : null;
  } else {
    if (ctx.db?.query) {
      organization = await ctx.db
        .query("organizations")
        .withIndex("by_ownerAuth0Id", (q: any) => q.eq("ownerAuth0Id", identity.subject))
        .first();
    } else if (typeof ctx.runQuery === "function") {
      organization = await ctx.runQuery(internal.organizations.getByOwnerAuth0Id, { auth0Id: identity.subject });
    }
    if (organization) {
      resolvedOrgId = organization._id as Id<"organizations">;
    }
  }

  const isRealOwner = Boolean(organization && organization.ownerAuth0Id === identity.subject);

  if (roles.includes("owner") && !isRealOwner) {
    roles = roles.filter((r: string) => r !== "owner");
  }

  if (isRealOwner && !roles.includes("owner")) {
    roles = [...roles, "owner"];
  }

  if (!roles.length) {
    let userRecord: any = null;
    if (ctx.db?.query) {
      userRecord = await ctx.db
        .query("users")
        .withIndex("by_auth0Id", (q: any) => q.eq("auth0Id", identity.subject))
        .first();
    } else if (typeof ctx.runQuery === "function") {
      userRecord = await ctx.runQuery(internal.users.getByAuth0Id, { auth0Id: identity.subject });
    }

    if (userRecord?.role && typeof userRecord.role === "string" && !roles.includes(userRecord.role)) {
      roles = [userRecord.role];
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
