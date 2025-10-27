// convex/provision.ts - Public Action for Auth0 Post-Registration
// Alternative to HTTP endpoint for self-hosted Convex

import type { Id } from "./_generated/dataModel";

import { ManagementClient } from "auth0";
import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

// Initialize Auth0 Management Client
function getManagementClient() {
  const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;

  if (!managementDomain) {
    throw new Error("Missing Auth0 domain. Set AUTH0_TENANT_DOMAIN or AUTH0_DOMAIN env variable.");
  }

  return new ManagementClient({
    domain: managementDomain,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
  });
}

/**
 * Provision endpoint as Convex Action (instead of HTTP route)
 *
 * This is called from Auth0 Post-Registration Action
 * For self-hosted Convex, actions work better than HTTP routes
 */
export const provisionOrganization = action({
  args: {
    auth0UserId: v.string(),
    email: v.string(),
    name: v.string(),
    webhookSecret: v.string(), // For verification
  },
  handler: async (ctx, args) => {
    // Verify webhook secret (if configured)
    const expectedSecret = process.env.CONVEX_WEBHOOK_SECRET;

    if (expectedSecret && args.webhookSecret !== expectedSecret) {
      console.error("[Provision] Secret mismatch!", {
        received: `${args.webhookSecret?.substring(0, 10)}...`,
        expected: `${expectedSecret?.substring(0, 10)}...`,
      });
      throw new Error("Unauthorized: Invalid webhook secret");
    }

    if (!expectedSecret) {
      console.warn("[Provision] WARNING: CONVEX_WEBHOOK_SECRET not set - skipping validation");
    }

    console.log("[Provision] Starting for:", {
      auth0UserId: args.auth0UserId,
      email: args.email,
    });

    try {
      const mgmt = getManagementClient();

      // 1. Create user in Convex
      const convexUserId: Id<"users"> = await ctx.runMutation(api.users.createFromAuth0, {
        auth0Id: args.auth0UserId,
        email: args.email,
        name: args.name,
        role: "owner",
      });

      console.log("[Provision] Convex user created:", convexUserId);

      // 2. Generate organization name and slug
      const orgName = args.name || args.email.split("@")[0];
      const baseSlug =
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/^-+|-+$/g, "")
          .replace(/-{2,}/g, "-")
          .slice(0, 48) || "store";

      console.log("[Provision] Generated slug:", baseSlug);

      // 3. Create Auth0 Organization (one per store!)
      let auth0OrgId: string;
      try {
        const auth0OrgResponse = await (mgmt.organizations as any).create({
          name: orgName,
          display_name: orgName,
          branding: {
            logo_url: "https://cdn.whatthepack.today/logo.png",
          },
          metadata: {
            convex_org_slug: baseSlug,
            created_via: "provisioning",
          },
        });

        auth0OrgId = auth0OrgResponse.id || auth0OrgResponse.data?.id;
        console.log("[Provision] Auth0 Organization created:", auth0OrgId);
      } catch (orgError: any) {
        console.error("[Provision] Failed to create Auth0 org:", orgError.message);
        throw new Error(`Failed to create Auth0 organization: ${orgError.message}`);
      }

      // 4. Add owner as member of the Auth0 organization
      try {
        const membersClient = (mgmt.organizations as any)?.members;
        if (membersClient?.create) {
          await membersClient.create(auth0OrgId, { members: [args.auth0UserId] });
        } else if (typeof (mgmt.organizations as any).addMembers === "function") {
          await (mgmt.organizations as any).addMembers({ id: auth0OrgId }, { members: [args.auth0UserId] });
        } else {
          throw new Error("No supported method to add organization members");
        }
        console.log("[Provision] Owner added to Auth0 organization");
      } catch (memberError: any) {
        console.error("[Provision] Failed to add member:", memberError.message);
        // Continue anyway - user exists but not in org
      }

      // 5. Enable database connection for the organization (BEST EFFORT)
      try {
        // Get the actual connection ID from environment or fetch by name
        let connectionId = process.env.AUTH0_CONNECTION_ID;

        if (!connectionId) {
          console.log("[Provision] AUTH0_CONNECTION_ID not set, fetching by name...");
          try {
            // Fetch all connections and find Username-Password-Authentication
            const connections = await (mgmt.connections as any).getAll({ name: "Username-Password-Authentication" });
            if (connections?.data && connections.data.length > 0) {
              connectionId = connections.data[0].id;
              console.log("[Provision] Found connection ID:", connectionId);
            } else if (connections && connections.length > 0) {
              connectionId = connections[0].id;
              console.log("[Provision] Found connection ID:", connectionId);
            } else {
              console.warn("[Provision] ⚠️  Username-Password-Authentication connection not found");
            }
          } catch (fetchError: any) {
            console.warn("[Provision] ⚠️  Failed to fetch connection:", fetchError.message);
          }
        }

        if (connectionId) {
          console.log("[Provision] Enabling connection:", connectionId);

          // Try multiple methods to enable connection
          let connectionEnabled = false;

          // Method 1: Try connectionsClient.create
          if (!connectionEnabled) {
            try {
              const connectionsClient = (mgmt.organizations as any)?.connections;
              if (connectionsClient?.create) {
                await connectionsClient.create(auth0OrgId, {
                  connection_id: connectionId,
                  assign_membership_on_login: false,
                });
                connectionEnabled = true;
                console.log("[Provision] ✅ Connection enabled (method 1)");
              }
            } catch (err: any) {
              console.log("[Provision] Method 1 failed:", err.message);
            }
          }

          // Method 2: Try addConnection
          if (!connectionEnabled) {
            try {
              if (typeof (mgmt.organizations as any).addConnection === "function") {
                await (mgmt.organizations as any).addConnection({ id: auth0OrgId }, { connection_id: connectionId });
                connectionEnabled = true;
                console.log("[Provision] ✅ Connection enabled (method 2)");
              }
            } catch (err: any) {
              console.log("[Provision] Method 2 failed:", err.message);
            }
          }

          // Method 3: Direct API call with fresh token
          if (!connectionEnabled) {
            try {
              const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;

              // Get a fresh Management API token
              const tokenResponse = await fetch(`https://${managementDomain}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  client_id: process.env.AUTH0_MGMT_CLIENT_ID,
                  client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
                  audience: `https://${managementDomain}/api/v2/`,
                  grant_type: "client_credentials",
                }),
              });

              if (!tokenResponse.ok) {
                console.log("[Provision] Method 3 failed: Could not get token");
              } else {
                const { access_token } = await tokenResponse.json();

                const response = await fetch(
                  `https://${managementDomain}/api/v2/organizations/${auth0OrgId}/enabled_connections`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${access_token}`,
                    },
                    body: JSON.stringify({
                      connection_id: connectionId,
                      assign_membership_on_login: false,
                    }),
                  },
                );

                if (response.ok) {
                  connectionEnabled = true;
                  console.log("[Provision] ✅ Connection enabled (method 3 - direct API)");
                } else {
                  const errorText = await response.text();
                  console.log("[Provision] Method 3 failed:", errorText);
                }
              }
            } catch (err: any) {
              console.log("[Provision] Method 3 failed:", err.message);
            }
          }

          if (!connectionEnabled) {
            console.warn("[Provision] ⚠️  Could not enable connection with any method");
            console.warn("[Provision] ⚠️  Organization login may not work properly");
            // Don't throw - continue provisioning
          }
        }
      } catch (connectionError: any) {
        console.warn("[Provision] ⚠️  Failed to enable database connection:", connectionError.message);
        // Don't throw - this is best effort. Continue provisioning.
      }

      // 6. Assign owner role in the organization
      try {
        const ownerRoleId = process.env.AUTH0_OWNER_ROLE_ID!;
        if (!ownerRoleId) {
          throw new Error("AUTH0_OWNER_ROLE_ID is not configured");
        }

        const rolesClient = (mgmt.organizations as any)?.members?.roles;
        if (rolesClient?.assign) {
          await rolesClient.assign(auth0OrgId, args.auth0UserId, { roles: [ownerRoleId] });
        } else if (typeof (mgmt.organizations as any).addMemberRoles === "function") {
          await (mgmt.organizations as any).addMemberRoles(
            { id: auth0OrgId, user_id: args.auth0UserId },
            { roles: [ownerRoleId] },
          );
        } else {
          throw new Error("No supported method to assign organization member roles");
        }
        console.log("[Provision] Owner role assigned in organization");
      } catch (roleError: any) {
        console.error("[Provision] Failed to assign role:", roleError.message);
        // Continue anyway
      }

      // 7. Create Convex organization with Auth0 org_id
      const orgId: Id<"organizations"> = await ctx.runMutation(api.organizations.create, {
        name: orgName,
        slug: baseSlug,
        ownerId: convexUserId,
        ownerAuth0Id: args.auth0UserId,
      });

      console.log("[Provision] Convex organization created:", orgId);

      // 8. Store Auth0 org_id in Convex
      await ctx.runMutation(internal.organizations.updateAuth0OrgId, {
        orgId,
        auth0OrgId,
      });

      console.log("[Provision] Auth0 org_id linked:", auth0OrgId);

      // 9. Link user to organization
      await ctx.runMutation(api.users.updateOrg, {
        userId: convexUserId,
        orgId,
      });

      console.log("[Provision] User linked to organization");

      return {
        success: true,
        orgId: orgId,
        auth0OrgId: auth0OrgId,
        slug: baseSlug,
        userId: convexUserId,
      };
    } catch (error: any) {
      console.error("[Provision] Error:", error.message);
      throw new Error(`Provisioning failed: ${error.message}`);
    }
  },
});
