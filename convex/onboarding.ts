// convex/onboarding.ts - Onboarding flow for new users

import type { Id } from "./_generated/dataModel";

import { ManagementClient } from "auth0";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { checkRateLimit } from "./security";

// Initialize Auth0 Management Client
function getManagementClient() {
  const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;
  if (!managementDomain) {
    throw new Error("Missing Auth0 domain");
  }
  return new ManagementClient({
    domain: managementDomain,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
  });
}

/**
 * Check if user has completed onboarding
 * Used by frontend to decide: redirect to /onboarding or /dashboard
 */
export const checkOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { needsOnboarding: false, reason: "Not authenticated" };
    }

    const auth0Id = identity.subject;

    // Check if user exists in Convex
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", auth0Id))
      .first();

    if (!user) {
      // User not in Convex yet → needs onboarding
      return {
        needsOnboarding: true,
        reason: "User not found in database",
        auth0Id,
      };
    }

    if (!user.orgId) {
      // User exists but no organization → needs onboarding
      return {
        needsOnboarding: true,
        reason: "No organization assigned",
        userId: user._id,
      };
    }

    // User has organization → onboarding complete
    return {
      needsOnboarding: false,
      reason: "Onboarding complete",
      userId: user._id,
      orgId: user.orgId,
    };
  },
});

/**
 * Complete onboarding - Create organization for user
 * Called from frontend onboarding form
 */
export const completeOnboarding = action({
  args: {
    storeName: v.string(),
    slug: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    orgId: Id<"organizations">;
    slug: string;
    userId: Id<"users">;
    auth0OrgId?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const auth0Id = identity.subject;
    const email = identity.email || "";
    const name = identity.name || email.split("@")[0];

    // SECURITY: Rate limiting - max 3 onboarding attempts per hour
    if (!checkRateLimit(`onboarding:${auth0Id}`, 3, 60 * 60 * 1000)) {
      throw new Error("Rate limit exceeded. You can only create 3 organizations per hour. Please try again later.");
    }

    console.log("[Onboarding] Starting for:", { auth0Id, email, storeName: args.storeName });

    // Validate slug
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(args.slug)) {
      throw new Error("Invalid slug format. Use only lowercase letters, numbers, and hyphens.");
    }

    if (args.slug.length < 3 || args.slug.length > 48) {
      throw new Error("Slug must be between 3 and 48 characters.");
    }

    // Check if slug already taken (must use query, not direct db access in action)
    const existingOrg = await ctx.runQuery(internal.onboarding.checkSlugExists, {
      slug: args.slug,
    });

    if (existingOrg) {
      throw new Error(`Slug "${args.slug}" is already taken. Please choose another.`);
    }

    // Check if user already exists
    const user = await ctx.runQuery(internal.onboarding.getUserByAuth0Id, {
      auth0Id,
    });

    let userId: Id<"users">;

    if (user) {
      // User exists, check if already has org
      if (user.orgId) {
        throw new Error("User already has an organization. Onboarding already completed.");
      }
      userId = user._id;
      console.log("[Onboarding] User found:", userId);
    } else {
      // Create new user
      userId = await ctx.runMutation(internal.onboarding.createUser, {
        auth0Id,
        email,
        name,
      });
      console.log("[Onboarding] User created:", userId);
    }

    // Create organization
    const orgId: Id<"organizations"> = await ctx.runMutation(internal.onboarding.createOrganization, {
      storeName: args.storeName,
      slug: args.slug,
      ownerId: userId,
      ownerAuth0Id: auth0Id,
    });

    console.log("[Onboarding] Organization created:", orgId);

    // Link user to organization
    await ctx.runMutation(internal.onboarding.linkUserToOrg, {
      userId,
      orgId,
    });

    console.log("[Onboarding] User linked to organization");

    // ===== LINK TO EXISTING OR CREATE AUTH0 ORGANIZATION =====
    const mgmt = getManagementClient();
    let auth0OrgId: string | undefined;

    try {
      // First, check if user already has an Auth0 organization (from provision flow)
      let existingOrgId: string | undefined;

      try {
        // Try to get user's current Auth0 profile to see if they have an org
        const userProfile = await (mgmt.users as any).get({ id: auth0Id });

        // Check if user is already in an organization
        if (userProfile?.data?.org_id || userProfile?.org_id) {
          existingOrgId = userProfile.data?.org_id || userProfile.org_id;
          console.log("[Onboarding] User already has Auth0 org from profile:", existingOrgId);
        }
      } catch (profileError: any) {
        console.log("[Onboarding] Could not get user profile:", profileError.message);
      }

      // If we found an existing org, use it
      if (existingOrgId) {
        auth0OrgId = existingOrgId;
        console.log("[Onboarding] Using existing Auth0 Organization:", auth0OrgId);
      } else {
        // No existing org found, create a new one
        console.log("[Onboarding] Creating new Auth0 Organization...");

        const auth0OrgResponse = await (mgmt.organizations as any).create({
          name: args.storeName,
          display_name: args.storeName,
          branding: {
            logo_url: "https://cdn.whatthepack.today/logo.png",
          },
          metadata: {
            convex_org_slug: args.slug,
            created_via: "onboarding",
          },
        });

        auth0OrgId = auth0OrgResponse.id || auth0OrgResponse.data?.id;
        console.log("[Onboarding] Auth0 Organization created:", auth0OrgId);
      }

      // Add owner as member
      try {
        const membersClient = (mgmt.organizations as any)?.members;
        if (membersClient?.create) {
          await membersClient.create(auth0OrgId, { members: [auth0Id] });
        } else if (typeof (mgmt.organizations as any).addMembers === "function") {
          await (mgmt.organizations as any).addMembers({ id: auth0OrgId }, { members: [auth0Id] });
        } else {
          throw new Error("No supported method to add organization members");
        }
        console.log("[Onboarding] Owner added to Auth0 organization");
      } catch (error: any) {
        console.error("[Onboarding] Failed to add member:", error.message);
      }

      // Assign owner role
      try {
        const ownerRoleId = process.env.AUTH0_OWNER_ROLE_ID!;
        const rolesClient = (mgmt.organizations as any)?.members?.roles;
        if (rolesClient?.assign) {
          await rolesClient.assign(auth0OrgId, auth0Id, { roles: [ownerRoleId] });
        } else if (typeof (mgmt.organizations as any).addMemberRoles === "function") {
          await (mgmt.organizations as any).addMemberRoles({ id: auth0OrgId, user_id: auth0Id }, { roles: [ownerRoleId] });
        } else {
          throw new Error("No supported method to assign organization roles");
        }
        console.log("[Onboarding] Owner role assigned");
      } catch (error: any) {
        console.error("[Onboarding] Failed to assign role:", error.message);
      }

      // Store Auth0 org_id in Convex
      if (!auth0OrgId) {
        throw new Error("Failed to get Auth0 organization ID");
      }

      await ctx.runMutation(internal.organizations.updateAuth0OrgId, {
        orgId,
        auth0OrgId,
      });
      console.log("[Onboarding] Auth0 org_id linked in Convex");

      // Enable Username-Password-Authentication connection for this Organization (idempotent best-effort)
      try {
        let connectionId = process.env.AUTH0_CONNECTION_ID;

        if (!connectionId) {
          console.log("[Onboarding] AUTH0_CONNECTION_ID not set, fetching DB connection by name...");
          try {
            const connections = await (mgmt.connections as any).getAll({ name: "Username-Password-Authentication" });
            if (connections?.data && connections.data.length > 0) {
              connectionId = connections.data[0].id;
              console.log("[Onboarding] Found connection ID:", connectionId);
            } else if (Array.isArray(connections) && connections.length > 0) {
              connectionId = connections[0].id;
              console.log("[Onboarding] Found connection ID:", connectionId);
            } else {
              console.warn("[Onboarding] Username-Password-Authentication connection not found");
            }
          } catch (fetchErr: any) {
            console.warn("[Onboarding] Failed to fetch DB connections:", fetchErr?.message || fetchErr);
          }
        }

        if (connectionId) {
          let enabled = false;

          // Method 1: SDK organizations.connections.create
          try {
            const connectionsClient = (mgmt.organizations as any)?.connections;
            if (connectionsClient?.create) {
              await connectionsClient.create(auth0OrgId, {
                connection_id: connectionId,
                assign_membership_on_login: false,
              });
              enabled = true;
              console.log("[Onboarding] ✅ Org connection enabled (SDK method 1)");
            }
          } catch (e: any) {
            console.log("[Onboarding] SDK method 1 failed:", e?.message || e);
          }

          // Method 2: SDK organizations.addConnection
          if (!enabled) {
            try {
              if (typeof (mgmt.organizations as any).addConnection === "function") {
                await (mgmt.organizations as any).addConnection({ id: auth0OrgId }, { connection_id: connectionId });
                enabled = true;
                console.log("[Onboarding] ✅ Org connection enabled (SDK method 2)");
              }
            } catch (e: any) {
              console.log("[Onboarding] SDK method 2 failed:", e?.message || e);
            }
          }

          // Method 3: Raw API
          if (!enabled) {
            try {
              const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;
              if (!managementDomain) throw new Error("Missing Auth0 domain");
              const tokenResp = await fetch(`https://${managementDomain}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  client_id: process.env.AUTH0_MGMT_CLIENT_ID,
                  client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
                  audience: `https://${managementDomain}/api/v2/`,
                  grant_type: "client_credentials",
                }),
              });
              if (!tokenResp.ok) throw new Error(`Token error ${tokenResp.status}`);
              const { access_token } = (await tokenResp.json()) as { access_token: string };
              const enableResp = await fetch(
                `https://${managementDomain}/api/v2/organizations/${auth0OrgId}/enabled_connections`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
                  body: JSON.stringify({ connection_id: connectionId, assign_membership_on_login: false }),
                },
              );
              if (enableResp.ok) {
                enabled = true;
                console.log("[Onboarding] ✅ Org connection enabled (raw API)");
              } else {
                const txt = await enableResp.text();
                console.warn("[Onboarding] Raw API enable failed:", txt);
              }
            } catch (e: any) {
              console.log("[Onboarding] Raw API method failed:", e?.message || e);
            }
          }

          if (!enabled) {
            console.warn("[Onboarding] ⚠️ Could not enable org DB connection. Check M2M scopes and connection ID.");
          }
        }
      } catch (connErr: any) {
        console.warn("[Onboarding] ⚠️ Enabling org connection failed:", connErr?.message || connErr);
      }
    } catch (error: any) {
      console.error("[Onboarding] Failed to create Auth0 org:", error.message);
      // Continue anyway - Convex org is created
    }

    // Update Auth0 user_metadata with organization info
    try {
      await ctx.runAction(internal.onboarding.updateAuth0Metadata, {
        auth0Id,
        orgId,
        slug: args.slug,
        auth0OrgId,
      });
      console.log("[Onboarding] Auth0 user_metadata updated");
    } catch (error: any) {
      console.error("[Onboarding] Failed to update Auth0 metadata:", error.message);
      // Don't throw - org is created, metadata update is secondary
    }

    return {
      success: true,
      orgId,
      slug: args.slug,
      userId,
      auth0OrgId,
    };
  },
});

// Internal queries and mutations for onboarding flow

export const checkSlugExists = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return org !== null;
  },
});

export const getUserByAuth0Id = internalQuery({
  args: { auth0Id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();
  },
});

export const createUser = internalMutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      auth0Id: args.auth0Id,
      email: args.email,
      name: args.name,
      role: "owner",
    });
  },
});

export const createOrganization = internalMutation({
  args: {
    storeName: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    ownerAuth0Id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("organizations", {
      name: args.storeName,
      slug: args.slug,
      ownerId: args.ownerId,
      ownerAuth0Id: args.ownerAuth0Id,
      onboardingCompleted: true,
      shipEngineConnected: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });
  },
});

export const linkUserToOrg = internalMutation({
  args: {
    userId: v.id("users"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      orgId: args.orgId,
    });
  },
});

export const updateAuth0Metadata = internalAction({
  args: {
    auth0Id: v.string(),
    orgId: v.id("organizations"),
    slug: v.string(),
    auth0OrgId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const managementDomain = process.env.AUTH0_TENANT_DOMAIN || process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
    const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;

    if (!managementDomain || !clientId || !clientSecret) {
      console.warn("[Onboarding] Auth0 Management API not configured - skipping metadata update");
      return;
    }

    // Get Management API token
    const tokenResponse = await fetch(`https://${managementDomain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${managementDomain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get management token: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json();

    // Update user metadata
    const updateResponse = await fetch(`https://${managementDomain}/api/v2/users/${encodeURIComponent(args.auth0Id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_metadata: {
          organization_id: args.orgId,
          organization_slug: args.slug,
          onboarding_completed: true,
          ...(args.auth0OrgId ? { organization_auth0_id: args.auth0OrgId } : {}),
        },
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update user metadata: ${error}`);
    }

    console.log("[Onboarding] Auth0 user_metadata updated successfully");
  },
});

/**
 * Check if slug is available
 * Used by frontend for real-time validation
 */
export const checkSlugAvailability = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // SECURITY: Rate limiting - max 100 slug checks per hour
    if (!checkRateLimit(`slug-check:${identity.subject}`, 100, 60 * 60 * 1000)) {
      throw new ConvexError("Rate limit exceeded. Too many slug availability checks. Please try again later.");
    }
    const slugRegex = /^[a-z0-9-]+$/;

    if (!slugRegex.test(args.slug)) {
      return {
        available: false,
        reason: "Invalid format. Use only lowercase letters, numbers, and hyphens.",
      };
    }

    if (args.slug.length < 3) {
      return {
        available: false,
        reason: "Too short. Minimum 3 characters.",
      };
    }

    if (args.slug.length > 48) {
      return {
        available: false,
        reason: "Too long. Maximum 48 characters.",
      };
    }

    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingOrg) {
      return {
        available: false,
        reason: "This slug is already taken.",
      };
    }

    return {
      available: true,
      reason: "Available!",
    };
  },
});

/**
 * Ensure Auth0 Organization exists for a slug and that the DB connection is enabled BEFORE login.
 * This is called from the subdomain (unauthenticated pre-login) to prevent
 * "no connections enabled for the organization" errors.
 */
export const ensureOrgLoginReady = action({
  args: { slug: v.string(), storeName: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const slugRegex = /^[a-z0-9-]+$/;
    const slug = args.slug.toLowerCase().trim();
    if (!slugRegex.test(slug) || slug.length < 3 || slug.length > 48) {
      throw new ConvexError("Invalid slug");
    }

    if (!checkRateLimit(`prelogin:${slug}`, 10, 60 * 60 * 1000)) {
      throw new ConvexError("Too many attempts, slow down");
    }

    const mgmt = getManagementClient();

    // 1) Ensure Auth0 Organization exists (idempotent)
    let auth0OrgId: string | undefined;
    try {
      let list: any;
      try {
        list = await (mgmt.organizations as any).getAll({ name: slug, per_page: 5 });
      } catch {
        list = await (mgmt.organizations as any).getAll({ per_page: 50 });
      }
      const existing = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
      const found = existing.find((o: any) => o?.name === slug);
      if (found?.id) {
        auth0OrgId = found.id;
      }
    } catch {}

    if (!auth0OrgId) {
      try {
        const created = await (mgmt.organizations as any).create({
          name: slug,
          display_name: args.storeName || slug,
          metadata: { convex_org_slug: slug, created_via: "prelogin" },
        });
        auth0OrgId = created?.id || created?.data?.id;
      } catch (_e: any) {
        // 409 or other → try to refetch by name
        try {
          const list = await (mgmt.organizations as any).getAll({ name: slug, per_page: 5 });
          const existing = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
          const found = existing.find((o: any) => o?.name === slug);
          if (found?.id) auth0OrgId = found.id;
        } catch {}
      }
    }

    if (!auth0OrgId) {
      throw new ConvexError("Failed to ensure Auth0 organization");
    }

    // 2) Ensure DB connection is enabled for the Organization (idempotent)
    let connectionId = process.env.AUTH0_CONNECTION_ID;
    try {
      if (!connectionId) {
        const conns = await (mgmt.connections as any).getAll({ name: "Username-Password-Authentication", per_page: 5 });
        const arr = Array.isArray(conns?.data) ? conns.data : Array.isArray(conns) ? conns : [];
        if (arr.length > 0) connectionId = arr[0].id;
      }
    } catch {}

    if (!connectionId) {
      throw new ConvexError("DB connection not found");
    }

    let enabled = false;
    try {
      const connectionsClient = (mgmt.organizations as any)?.connections;
      if (connectionsClient?.create) {
        await connectionsClient.create(auth0OrgId, { connection_id: connectionId, assign_membership_on_login: false });
        enabled = true;
      }
    } catch {}

    if (!enabled) {
      try {
        if (typeof (mgmt.organizations as any).addConnection === "function") {
          await (mgmt.organizations as any).addConnection({ id: auth0OrgId }, { connection_id: connectionId });
          enabled = true;
        }
      } catch {}
    }

    if (!enabled) {
      // Another agent may have done it or Auth0 disallows duplicate; treat as best-effort
      // We won't throw to avoid blocking login
    }

    return { ensured: true, auth0OrgId };
  },
});
// Force rebuild
