// convex/mgmt.ts - Auth0 Management API Wrappers

import { ManagementClient } from "auth0";
import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireRole } from "./auth";
import { checkRateLimit, validateEmail } from "./security";

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

function getManagementDomain(): string {
  const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;
  if (!managementDomain) throw new Error("Missing Auth0 domain. Set AUTH0_TENANT_DOMAIN or AUTH0_DOMAIN.");
  return managementDomain;
}

async function getManagementAccessToken(): Promise<string> {
  const domain = getManagementDomain();
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID!;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET!;
  const audience = `https://${domain}/api/v2/`;

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      grant_type: "client_credentials",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Auth0 token error (${res.status}): ${json?.error || json?.message || res.statusText}`);
  const token = json?.access_token as string | undefined;
  if (!token) throw new Error("Auth0 token response missing access_token");
  return token;
}

async function createPasswordChangeTicketRaw(params: {
  user_id: string;
  result_url?: string;
  ttl_sec?: number;
  mark_email_as_verified?: boolean;
}): Promise<string> {
  const domain = getManagementDomain();
  const token = await getManagementAccessToken();
  const res = await fetch(`https://${domain}/api/v2/tickets/password-change`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...params, mark_email_as_verified: params.mark_email_as_verified ?? true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Password ticket error (${res.status}): ${json?.error || json?.message || res.statusText}`);
  const ticketUrl = (json as any)?.ticket as string | undefined;
  if (!ticketUrl) throw new Error("Password ticket response missing ticket URL");
  return ticketUrl;
}

function generateTempPassword(): string {
  // 16+ chars, mixed sets to satisfy common Auth0 password policies
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[]:" + ";'<>,.?/";
  let pwd = "";
  for (let i = 0; i < 20; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// Store ShipEngine API key in Auth0 Organization Metadata
export const storeShipEngineToken = action({
  args: {
    orgId: v.id("organizations"),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization (requireRole does this internally)
    await requireRole(ctx, args.orgId, ["owner"]);

    // SECURITY: Rate limiting - max 10 staff invitations per hour
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Use a specific key for ShipEngine connect attempts
    if (!checkRateLimit(`shipengine:connect:${args.orgId}`, 5, 60 * 60 * 1000)) {
      throw new Error("Rate limit exceeded. Please try again in a while.");
    }

    const mgmt = getManagementClient();

    try {
      // Get organization from Convex to check for Auth0 org ID
      const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
      if (!org) throw new Error("Organization not found");

      let auth0OrgId = org.auth0OrgId;

      // IMPORTANT: Check if cached ID is valid Auth0 format (starts with "org_")
      if (auth0OrgId && !auth0OrgId.startsWith("org_")) {
        console.log("[storeShipEngineToken] Cached ID is invalid, clearing:", auth0OrgId);
        auth0OrgId = undefined;
      }

      // If we don't have Auth0 org ID stored, get it from user profile
      if (!auth0OrgId) {
        console.log("[storeShipEngineToken] Auth0 org ID not found, fetching from Auth0...");

        try {
          // Get user details from Auth0 to find their organization
          const userProfile = await (mgmt.users as any).get(identity.subject);

          console.log("[storeShipEngineToken] User profile:", userProfile);

          // Check if user has org_id in profile
          if (userProfile.org_id) {
            auth0OrgId = userProfile.org_id;
            console.log("[storeShipEngineToken] Found Auth0 org ID from profile:", auth0OrgId);
          } else {
            // Fallback: List all organizations and check membership
            const orgs = await (mgmt.organizations as any).list();
            console.log("[storeShipEngineToken] Found organizations:", orgs.data?.length || 0);

            if (!orgs.data || orgs.data.length === 0) {
              throw new Error("No Auth0 organizations found");
            }

            // For now, use the first organization (owner should only have one)
            auth0OrgId = orgs.data[0].id;
            console.log("[storeShipEngineToken] Using first organization:", auth0OrgId);
          }

          if (!auth0OrgId) {
            throw new Error("Could not determine Auth0 organization ID");
          }

          // Save Auth0 org ID to Convex for future use
          await ctx.runMutation(internal.organizations.updateAuth0OrgId, {
            orgId: args.orgId,
            auth0OrgId: auth0OrgId as string,
          });
        } catch (error: any) {
          console.error("[storeShipEngineToken] Error fetching Auth0 org ID:", error);
          throw new Error(`Could not find Auth0 organization: ${error.message}`);
        }
      }

      console.log("[storeShipEngineToken] Using Auth0 org ID:", auth0OrgId);
      console.log("[storeShipEngineToken] Auth0 org ID type:", typeof auth0OrgId);
      console.log("[storeShipEngineToken] Auth0 org ID length:", auth0OrgId?.length);

      // Verify it's a valid string
      if (typeof auth0OrgId !== "string" || auth0OrgId.length === 0) {
        throw new Error(`Invalid Auth0 org ID: ${auth0OrgId}`);
      }

      // Store in Auth0 Organization Metadata (encrypted at rest)
      // Using 'as any' because SDK types may vary across versions
      await (mgmt.organizations as any).update(auth0OrgId, {
        metadata: {
          shipengine_api_key: args.apiKey,
        },
      });

      // Update org status in Convex
      await ctx.runMutation(api.organizations.update, {
        orgId: args.orgId,
        shipEngineConnected: true,
      });

      return { success: true };
    } catch (error: any) {
      console.error("[storeShipEngineToken] Error:", error);
      throw new Error(`Failed to store ShipEngine token: ${error.message}`);
    }
  },
});

// Retrieve ShipEngine API key from Organization Metadata (expects Auth0 org id: org_*)
export async function getShipEngineApiKey(auth0OrgId: string): Promise<string> {
  const mgmt = getManagementClient();

  try {
    if (!auth0OrgId || !auth0OrgId.startsWith("org_")) {
      throw new Error("Invalid Auth0 organization id");
    }
    const org = await (mgmt as any).organizations.get({ id: auth0OrgId });
    const apiKey = org.data.metadata?.shipengine_api_key;

    if (!apiKey) {
      throw new Error("ShipEngine API key not configured for this organization");
    }

    return apiKey as string;
  } catch (error: any) {
    throw new Error(`Failed to retrieve ShipEngine token: ${error.message}`);
  }
}

// Check if ShipEngine is configured for an organization
export const checkShipEngineStatus = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner", "admin"]);

    try {
      const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
      if (!org?.auth0OrgId) return { configured: false };
      await getShipEngineApiKey(org.auth0OrgId);
      return { configured: true };
    } catch {
      return { configured: false };
    }
  },
});

// Staff invitation workflow using Auth0 Management API
export const inviteStaff = action({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    username: v.string(),
    role: v.union(v.literal("admin"), v.literal("packer")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; inviteId: any; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify inviter is owner
    await requireRole(ctx, args.orgId, ["owner"]);

    // Get organization details
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const mgmt = getManagementClient();

    try {
      // 1. Create user in Auth0 (DB connection requires a password)
      let newUser: any;
      try {
        // Detect whether the DB connection requires username; if not, omit username to avoid 400
        let requiresUsername = false;
        try {
          const cons = await (mgmt.connections as any).getAll({ name: "Username-Password-Authentication" });
          const list = Array.isArray(cons?.data) ? cons.data : Array.isArray(cons) ? cons : [];
          const db = list[0];
          requiresUsername = Boolean(db?.options?.requires_username || db?.requires_username);
        } catch {}

        const payload: any = {
          email: args.email,
          connection: "Username-Password-Authentication",
          password: generateTempPassword(),
          email_verified: false,
          verify_email: false,
        };
        if (requiresUsername && args.username) payload.username = args.username;

        try {
          newUser = await mgmt.users.create(payload as any);
        } catch (err: any) {
          const msg = err?.message || "";
          // If server complains about username on a connection without requires_username, retry without username
          if (msg.includes("Cannot set username for connection without requires_username") || err?.statusCode === 400) {
            delete payload.username;
            newUser = await mgmt.users.create(payload as any);
          } else {
            throw err;
          }
        }
      } catch (e: any) {
        // If user already exists, fetch the user and continue
        const message = e?.message || "";
        if (message.includes("exists") || message.includes("Already exists") || e?.statusCode === 409) {
          const users = await mgmt.users.listUsersByEmail({ email: args.email });
          if (!users || users.length === 0) throw e;
          newUser = { data: users[0] } as any;
        } else {
          throw e;
        }
      }

      const createdUser: any = (newUser as any)?.data ?? newUser;
      const auth0UserId: string | undefined = createdUser?.user_id || createdUser?.userId || createdUser?.id;
      if (!auth0UserId) {
        console.error("[inviteStaff] Unexpected create user response shape:", newUser);
        throw new Error("Auth0 user_id missing after user creation");
      }
      let auth0OrgId = org.auth0OrgId as string | undefined;

      // Ensure Auth0 Organization exists and sync its ID back to Convex if missing
      if (!auth0OrgId) {
        try {
          const domain = getManagementDomain();
          const token = await getManagementAccessToken();

          // Try create; if exists, fall back to list & find
          const createResp = await fetch(`https://${domain}/api/v2/organizations`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: org.slug,
              display_name: org.name || org.slug,
              metadata: { convex_org_slug: org.slug, created_via: "inviteStaff" },
            }),
          });

          if (createResp.ok) {
            const created = await createResp.json();
            auth0OrgId = created?.id;
          } else if (createResp.status === 409 || createResp.status === 400) {
            // List and find by name/metadata
            let page = 0;
            while (!auth0OrgId && page < 10) {
              const listResp = await fetch(`https://${domain}/api/v2/organizations?per_page=50&page=${page}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const listJson: any = (await listResp.json().catch(() => ({}))) || [];
              const arr = Array.isArray(listJson)
                ? listJson
                : Array.isArray(listJson?.organizations)
                  ? listJson.organizations
                  : [];
              const found = arr.find((o: any) => o?.name === org.slug || o?.metadata?.convex_org_slug === org.slug);
              if (found?.id) auth0OrgId = found.id;
              page += 1;
              if (!listResp.ok || arr.length === 0) break;
            }
          }

          if (!auth0OrgId) throw new Error("Failed to ensure Auth0 organization");

          // Persist back to Convex
          await ctx.runMutation(internal.organizations.updateAuth0OrgId, { orgId: args.orgId, auth0OrgId });

          // Best-effort: enable DB connection via raw API
          try {
            let connectionId = process.env.AUTH0_CONNECTION_ID;
            if (!connectionId) {
              const consResp = await fetch(
                `https://${domain}/api/v2/connections?strategy=auth0&name=Username-Password-Authentication`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              const consJson: any = await consResp.json().catch(() => ({}));
              const carr = Array.isArray(consJson) ? consJson : [];
              if (carr.length > 0) connectionId = carr[0].id;
            }
            if (connectionId) {
              await fetch(`https://${domain}/api/v2/organizations/${auth0OrgId}/enabled_connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ connection_id: connectionId, assign_membership_on_login: false }),
              }).catch(() => {});
            }
          } catch (e) {
            console.warn("[inviteStaff] Best-effort enable DB connection (raw) failed:", e);
          }
        } catch (e: any) {
          console.error("[inviteStaff] Failed to ensure Auth0 org:", e?.message || e);
          throw new Error("Organization is missing auth0OrgId. Please re-provision the tenant.");
        }
      }

      // 2. Add user to organization
      const membersClient = (mgmt.organizations as any)?.members;
      if (membersClient?.create) {
        await membersClient.create(auth0OrgId, { members: [auth0UserId] });
      } else if (typeof (mgmt.organizations as any).addMembers === "function") {
        await (mgmt.organizations as any).addMembers({ id: auth0OrgId }, { members: [auth0UserId] });
      } else {
        throw new Error("Auth0 SDK missing organization membership method");
      }

      // 3. Assign role within the ORGANIZATION context (not tenant-wide)
      const roleId = args.role === "admin" ? process.env.AUTH0_ADMIN_ROLE_ID! : process.env.AUTH0_PACKER_ROLE_ID!;
      if (!roleId) throw new Error(`Missing Auth0 role id for ${args.role}`);
      const orgsAny: any = (mgmt as any).organizations;
      if (orgsAny?.addMemberRoles) {
        await orgsAny.addMemberRoles({ id: auth0OrgId, user_id: auth0UserId }, { roles: [roleId] });
      } else if (orgsAny?.members?.roles?.add) {
        await orgsAny.members.roles.add(auth0OrgId, auth0UserId, { roles: [roleId] });
      } else {
        // Fallback: raw HTTP
        const token = await getManagementAccessToken();
        await fetch(
          `https://${getManagementDomain()}/api/v2/organizations/${auth0OrgId}/members/${encodeURIComponent(auth0UserId)}/roles`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roles: [roleId] }),
          },
        );
      }

      // 3b. Safety: ensure OWNER role is not attached in org context
      try {
        const ownerRoleId = process.env.AUTH0_OWNER_ROLE_ID;
        if (ownerRoleId) {
          if (orgsAny?.deleteMemberRoles) {
            await orgsAny.deleteMemberRoles({ id: auth0OrgId, user_id: auth0UserId }, { roles: [ownerRoleId] });
          } else if (orgsAny?.members?.roles?.remove) {
            await orgsAny.members.roles.remove(auth0OrgId, auth0UserId, { roles: [ownerRoleId] });
          } else {
            const token = await getManagementAccessToken();
            await fetch(
              `https://${getManagementDomain()}/api/v2/organizations/${auth0OrgId}/members/${encodeURIComponent(auth0UserId)}/roles`,
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ roles: [ownerRoleId] }),
              },
            );
          }
        }
      } catch (e) {
        console.warn("[inviteStaff] Owner role removal warning:", e);
      }

      // 4. Send enrollment email
      // 4. Send enrollment email (password change ticket)
      let ticketUrl: string | undefined;
      try {
        const ticketsAny: any = (mgmt as any).tickets;
        if (ticketsAny?.createPasswordChangeTicket) {
          const ticketResp = await ticketsAny.createPasswordChangeTicket({
            user_id: auth0UserId,
            result_url: `https://${org.slug}.whatthepack.today/login`,
            ttl_sec: 86400,
            mark_email_as_verified: true,
          });
          ticketUrl = (ticketResp as any)?.data?.ticket || (ticketResp as any)?.ticket;
        } else if (ticketsAny?.create) {
          const ticketResp = await ticketsAny.create({
            user_id: auth0UserId,
            result_url: `https://${org.slug}.whatthepack.today/login`,
            ttl_sec: 86400,
            mark_email_as_verified: true,
          });
          ticketUrl = (ticketResp as any)?.data?.ticket || (ticketResp as any)?.ticket;
        }
      } catch (e) {
        console.warn("[inviteStaff] SDK tickets method not available, falling back to raw API:", e);
      }

      if (!ticketUrl) {
        ticketUrl = await createPasswordChangeTicketRaw({
          user_id: auth0UserId,
          result_url: `https://${org.slug}.whatthepack.today/login`,
          ttl_sec: 86400,
        });
      }

      // 5. Ensure user exists in Convex with org context
      await ctx.runMutation((internal as any).users.upsertAuth0User, {
        auth0Id: auth0UserId,
        email: args.email,
        orgId: args.orgId,
        role: args.role,
        username: args.username,
      });

      // 6. Store invite record in Convex
      const inviteId: any = await ctx.runMutation((api as any).invites.create, {
        orgId: args.orgId,
        email: args.email,
        username: args.username,
        role: args.role,
        invitedBy: org.ownerId,
      });

      // Update invite with Auth0 details
      await ctx.runMutation((api as any).invites.updateStatus, {
        inviteId,
        status: "pending",
        auth0UserId,
        ticketUrl: ticketUrl,
      });

      // 7. Email staff invite with password setup link
      try {
        await ctx.runAction((internal as any).emails.sendStaffInvite, {
          orgId: args.orgId,
          email: args.email,
          username: args.username,
          role: args.role,
          ticketUrl: ticketUrl,
        });
      } catch (e) {
        console.warn("[inviteStaff] Failed to send staff invite email:", e);
      }

      return {
        success: true,
        inviteId,
        message: `Invitation sent to ${args.email}`,
      };
    } catch (error: any) {
      console.error("Staff invitation error:", error);
      throw new Error(`Failed to invite staff: ${error.message}`);
    }
  },
});

// Remove staff member (owner only)
export const removeStaff = action({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization (requireRole does this internally)
    await requireRole(ctx, args.orgId, ["owner"]);

    const user = await ctx.runQuery(internal.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("User not found");

    if (user.role === "owner") {
      throw new Error("Cannot remove organization owner");
    }

    // Remove user from Auth0 Organization membership, then deactivate locally
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org?.auth0OrgId) throw new Error("Organization not linked to Auth0 (missing auth0OrgId)");

    if (!user.auth0Id) throw new Error("User missing auth0Id");

    try {
      const mgmt = getManagementClient();
      const membersClient = (mgmt.organizations as any)?.members;
      if (membersClient?.delete) {
        // v5 style
        await membersClient.delete(org.auth0OrgId, { members: [user.auth0Id] });
      } else if (typeof (mgmt.organizations as any).removeMembers === "function") {
        // legacy style
        await (mgmt.organizations as any).removeMembers({ id: org.auth0OrgId }, { members: [user.auth0Id] });
      }
    } catch (e) {
      console.warn("Auth0 remove member warning:", e);
    }

    await ctx.runMutation(internal.users.deactivateUser, { userId: args.userId });

    try {
      if (user.email) {
        await ctx.runMutation((internal as any).invites.expirePendingByEmail, {
          orgId: args.orgId,
          email: user.email,
        });
      }
    } catch (error) {
      console.warn("[removeStaff] Failed to expire pending invites", error);
    }

    return { success: true };
  },
});

// List staff members (owner only)
export const listStaff = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<any[]> => {
    await requireRole(ctx, args.orgId, ["owner"]);

    try {
      const invites = await ctx.runQuery((api as any).invites.listForOrgInternal, {
        orgId: args.orgId,
        status: "pending",
      });
      const upsertPromises: Promise<any>[] = [];

      for (const invite of invites as any[]) {
        if (!invite?.auth0UserId) continue;
        upsertPromises.push(
          ctx.runMutation((internal as any).users.upsertAuth0User, {
            auth0Id: invite.auth0UserId,
            email: invite.email,
            orgId: args.orgId,
            role: invite.role,
            username: invite.username,
          }),
        );
      }

      if (upsertPromises.length > 0) {
        await Promise.allSettled(upsertPromises);
      }
    } catch (error) {
      console.warn("[listStaff] Failed to reconcile invites with users", error);
    }

    // Get all users in organization
    const users: any[] = await ctx.runQuery(internal.users.listByOrg, { orgId: args.orgId });

    return users.filter((u: any) => u.role !== "owner");
  },
});

// Update staff role (owner only)
export const updateStaffRole = action({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    newRole: v.union(v.literal("admin"), v.literal("packer")),
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate user has access to this organization (requireRole does this internally)
    await requireRole(ctx, args.orgId, ["owner"]);

    const user = await ctx.runQuery(internal.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("User not found");

    if (user.role === "owner") {
      throw new Error("Cannot change owner role");
    }

    // Update role in Auth0 ORGANIZATION context
    if (!user.auth0Id) throw new Error("User missing auth0Id");
    const mgmt = getManagementClient();
    const adminRoleId = process.env.AUTH0_ADMIN_ROLE_ID!;
    const packerRoleId = process.env.AUTH0_PACKER_ROLE_ID!;
    const targetRoleId = args.newRole === "admin" ? adminRoleId : packerRoleId;

    // Load org
    const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org?.auth0OrgId) throw new Error("Organization not linked to Auth0 (missing auth0OrgId)");

    try {
      const orgsAny: any = (mgmt as any).organizations;
      // Remove both admin/packer roles first
      if (orgsAny?.deleteMemberRoles) {
        await orgsAny.deleteMemberRoles({ id: org.auth0OrgId, user_id: user.auth0Id }, { roles: [adminRoleId, packerRoleId] });
      } else if (orgsAny?.members?.roles?.remove) {
        await orgsAny.members.roles.remove(org.auth0OrgId, user.auth0Id, { roles: [adminRoleId, packerRoleId] });
      } else {
        const token = await getManagementAccessToken();
        await fetch(
          `https://${getManagementDomain()}/api/v2/organizations/${org.auth0OrgId}/members/${encodeURIComponent(user.auth0Id)}/roles`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roles: [adminRoleId, packerRoleId] }),
          },
        );
      }

      // Assign target role
      if (orgsAny?.addMemberRoles) {
        await orgsAny.addMemberRoles({ id: org.auth0OrgId, user_id: user.auth0Id }, { roles: [targetRoleId] });
      } else if (orgsAny?.members?.roles?.add) {
        await orgsAny.members.roles.add(org.auth0OrgId, user.auth0Id, { roles: [targetRoleId] });
      } else {
        const token = await getManagementAccessToken();
        await fetch(
          `https://${getManagementDomain()}/api/v2/organizations/${org.auth0OrgId}/members/${encodeURIComponent(user.auth0Id)}/roles`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roles: [targetRoleId] }),
          },
        );
      }
    } catch (e) {
      console.warn("Auth0 role update warning:", e);
    }

    // Update in Convex
    await ctx.runMutation(internal.users.updateRole, { userId: args.userId, role: args.newRole });

    return { success: true };
  },
});

// Resend verification email (public action - no auth required)
export const resendVerificationEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (_ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    if (!checkRateLimit(`resend-verification:${normalizedEmail}`, 3, 15 * 60 * 1000)) {
      throw new Error("Too many resend attempts. Please wait a few minutes before trying again.");
    }

    const mgmt = getManagementClient();

    try {
      // Find user by email in Auth0 using listUsersByEmail method
      const users = await mgmt.users.listUsersByEmail({ email: normalizedEmail });

      if (!users || users.length === 0) {
        throw new Error("User not found");
      }

      const user = users[0];
      const userId = user.user_id;

      if (!userId) {
        throw new Error("User ID not found");
      }

      // Check if email is already verified
      if (user.email_verified) {
        return {
          success: false,
          message: "Email is already verified",
          alreadyVerified: true,
        };
      }

      // Trigger verification email using Auth0 Management API jobs endpoint
      await mgmt.jobs.verificationEmail.create({
        user_id: userId,
      });

      console.log(`[resendVerificationEmail] Verification email sent to ${normalizedEmail}`);

      return {
        success: true,
        message: "Verification email sent successfully",
        alreadyVerified: false,
      };
    } catch (error: any) {
      console.error("[resendVerificationEmail] Error:", error);
      throw new Error(`Failed to resend verification email: ${error.message}`);
    }
  },
});
