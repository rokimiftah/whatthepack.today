// convex/testing.ts - Testing utilities (CLI-callable)

import type { ActionCtx } from "./_generated/server";

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

const RESERVED_SLUGS = new Set(["www", "app", "dev"]);

/**
 * Manual provisioning for testing via CLI
 * Usage: bunx convex run testing:provisionManual '{"auth0UserId":"test_123","email":"test@example.com","name":"Test Owner"}'
 */
export const provisionManual = action({
  args: {
    auth0UserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    orgName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    orgId: string;
    slug: string;
    subdomain: string;
    userId?: string;
  }> => {
    const { auth0UserId, email, name, orgName } = args;

    const normalizedEmail = email.toLowerCase().trim();
    const ownerDisplayName = (name ?? normalizedEmail.split("@")[0]).trim();

    try {
      // Check if organization already exists for this user
      const existingOrg = await ctx.runQuery(internal.organizations.getByOwnerAuth0Id, {
        auth0Id: auth0UserId,
      });

      if (existingOrg) {
        console.log("✅ Organization already exists:", existingOrg.slug);
        return {
          success: true,
          message: "Organization already exists",
          orgId: existingOrg._id,
          slug: existingOrg.slug,
          subdomain: `${existingOrg.slug}.dev.whatthepack.today`,
        };
      }

      // Create or fetch owner user record
      const ownerUserId = await ctx.runMutation(api.users.createFromAuth0, {
        auth0Id: auth0UserId,
        email: normalizedEmail,
        name: ownerDisplayName,
        role: "owner",
      });

      // Generate unique slug
      const preferredName = (orgName ?? ownerDisplayName).trim();
      const baseSlug = slugify(preferredName);
      const slug = await generateUniqueSlug(ctx, baseSlug);

      const organizationName = orgName?.trim() && orgName.trim().length > 0 ? orgName.trim() : `${ownerDisplayName}'s Business`;

      // Create organization
      const orgId = await ctx.runMutation(api.organizations.create, {
        name: organizationName,
        slug,
        ownerId: ownerUserId,
        ownerAuth0Id: auth0UserId,
      });

      // Link owner to organization
      await ctx.runMutation(api.users.updateOrg, {
        userId: ownerUserId,
        orgId,
      });

      console.log("✅ Organization provisioned successfully!");
      console.log(`   - Organization ID: ${orgId}`);
      console.log(`   - Slug: ${slug}`);
      console.log(`   - Subdomain: ${slug}.dev.whatthepack.today`);

      return {
        success: true,
        message: "Organization provisioned",
        orgId,
        slug,
        subdomain: `${slug}.dev.whatthepack.today`,
        userId: ownerUserId,
      };
    } catch (error: any) {
      console.error("❌ Provisioning error:", error);
      throw new Error(`Provisioning failed: ${error.message}`);
    }
  },
});

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 48) || "store"
  );
}

async function generateUniqueSlug(ctx: ActionCtx, baseSlug: string): Promise<string> {
  const sanitizedBase = baseSlug.length > 0 ? baseSlug : "store";
  let candidate = sanitizedBase;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await ctx.runQuery(api.organizations.getBySlug, { slug: candidate });
    if (!existing && !RESERVED_SLUGS.has(candidate)) {
      return candidate;
    }
    suffix += 1;
    candidate = `${sanitizedBase}-${suffix}`;
  }
}

/**
 * Fix missing auth0OrgId for a specific organization
 * Usage: bunx convex run testing:fixAuth0OrgId '{"orgId":"kd7..."}'
 */
export const fixAuth0OrgId = action({
  args: {
    orgId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    orgId?: string;
    slug?: string;
    auth0OrgId: string;
    message: string;
  }> => {
    const { ManagementClient } = await import("auth0");

    const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;
    if (!managementDomain) {
      throw new Error("Missing Auth0 domain");
    }

    const mgmt = new ManagementClient({
      domain: managementDomain,
      clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
      clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
    });

    console.log(`[Fix] Processing organization: ${args.orgId}`);

    // Get organization from Convex
    const org: any = await ctx.runQuery(internal.organizations.get, {
      orgId: args.orgId as any,
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    console.log(`[Fix] Organization:`, {
      name: org.name,
      slug: org.slug,
      ownerAuth0Id: org.ownerAuth0Id,
      currentAuth0OrgId: org.auth0OrgId,
    });

    if (org.auth0OrgId) {
      console.log(`[Fix] ✅ Organization already has auth0OrgId: ${org.auth0OrgId}`);
      return {
        success: true,
        message: "Already has auth0OrgId",
        auth0OrgId: org.auth0OrgId,
      };
    }

    // Look up Auth0 organizations for the owner
    const ownerAuth0Id = org.ownerAuth0Id;

    console.log(`[Fix] Searching for existing Auth0 organizations...`);

    // Search for existing Auth0 org by name
    let auth0OrgId: string | undefined;

    try {
      // Try to find existing organization by name
      const allOrgs = await (mgmt.organizations as any).getAll();
      const existingOrg = allOrgs.data?.find(
        (o: any) =>
          o.name === org.name ||
          o.display_name === org.name ||
          o.metadata?.convex_org_slug === org.slug ||
          o.metadata?.convex_org_id === org._id,
      );

      if (existingOrg) {
        auth0OrgId = existingOrg.id;
        console.log(`[Fix] Found existing Auth0 org by name/metadata: ${auth0OrgId}`);
        console.log(`[Fix] Auth0 org name: ${existingOrg.name || existingOrg.display_name}`);
      }
    } catch (error: any) {
      console.log(`[Fix] Could not search orgs: ${error.message}`);
    }

    // If still not found, try to create new
    if (!auth0OrgId) {
      console.log(`[Fix] No existing Auth0 org found, creating new...`);

      try {
        const auth0OrgResponse = await (mgmt.organizations as any).create({
          name: `${org.name}-${Date.now()}`, // Add timestamp to avoid conflicts
          display_name: org.name,
          branding: {
            logo_url: "https://cdn.whatthepack.today/logo.png",
          },
          metadata: {
            convex_org_slug: org.slug,
            created_via: "fix_script",
            convex_org_id: org._id,
          },
        });

        auth0OrgId = auth0OrgResponse.id || auth0OrgResponse.data?.id;
        console.log(`[Fix] Created Auth0 org: ${auth0OrgId}`);
      } catch (createError: any) {
        console.error(`[Fix] Failed to create Auth0 org: ${createError.message}`);
        throw createError;
      }
    }

    // If we still don't have an auth0OrgId, fail
    if (!auth0OrgId) {
      throw new Error("Could not find or create Auth0 organization");
    }

    // Add owner as member (for both existing and new orgs)
    try {
      const membersClient = (mgmt.organizations as any)?.members;
      if (membersClient?.create) {
        await membersClient.create(auth0OrgId, { members: [ownerAuth0Id] });
      } else {
        await (mgmt.organizations as any).addMembers({ id: auth0OrgId }, { members: [ownerAuth0Id] });
      }
      console.log(`[Fix] Owner added to Auth0 org`);
    } catch (error: any) {
      console.warn(`[Fix] Failed to add member: ${error.message}`);
    }

    // Assign owner role
    try {
      const ownerRoleId = process.env.AUTH0_OWNER_ROLE_ID!;
      const rolesClient = (mgmt.organizations as any)?.members?.roles;
      if (rolesClient?.assign) {
        await rolesClient.assign(auth0OrgId, ownerAuth0Id, { roles: [ownerRoleId] });
      } else {
        await (mgmt.organizations as any).addMemberRoles({ id: auth0OrgId, user_id: ownerAuth0Id }, { roles: [ownerRoleId] });
      }
      console.log(`[Fix] Owner role assigned`);
    } catch (error: any) {
      console.warn(`[Fix] Failed to assign role: ${error.message}`);
    }

    // Enable database connection
    try {
      const connectionsResponse = await (mgmt.connections as any).getAll({
        name: "Username-Password-Authentication",
      });
      const connectionId = connectionsResponse?.data?.[0]?.id || connectionsResponse?.[0]?.id;

      if (connectionId) {
        const connectionsClient = (mgmt.organizations as any)?.connections;
        if (connectionsClient?.create) {
          await connectionsClient.create(auth0OrgId, {
            connection_id: connectionId,
            assign_membership_on_login: false,
          });
        } else {
          await (mgmt.organizations as any).addConnection({ id: auth0OrgId }, { connection_id: connectionId });
        }
        console.log(`[Fix] Database connection enabled`);
      }
    } catch (error: any) {
      console.warn(`[Fix] Failed to enable connection: ${error.message}`);
    }

    // Update Convex organization with auth0OrgId
    await ctx.runMutation(internal.organizations.updateAuth0OrgId, {
      orgId: org._id,
      auth0OrgId,
    });

    console.log(`[Fix] ✅ Organization fixed successfully!`);

    return {
      success: true,
      orgId: org._id,
      slug: org.slug,
      auth0OrgId,
      message: "Organization fixed successfully",
    };
  },
});

export const seedOwnerProducts = action({
  args: {
    orgId: v.optional(v.id("organizations")),
    auth0OrgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let org: any = null;

    if (args.orgId) {
      org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    } else if (args.auth0OrgId) {
      org = await ctx.runQuery(internal.organizations.getByAuth0OrgId, { auth0OrgId: args.auth0OrgId });
    }

    if (!org) {
      throw new Error("Organization not found. Provide a valid orgId or auth0OrgId.");
    }

    const orgId = org._id as string;

    const seedProducts = [
      {
        sku: "TSHIRT-BK-M",
        name: "Black Tee - Medium",
        description: "Staple unisex cotton tee (M)",
        costOfGoods: 5.5,
        sellPrice: 14.9,
        stockQuantity: 40,
        warehouseLocation: "A1-01",
        sop_packing: "Fold 3x, insert thank-you card, polymailer M",
        weight: 220,
      },
      {
        sku: "TSHIRT-BK-L",
        name: "Black Tee - Large",
        description: "Staple unisex cotton tee (L)",
        costOfGoods: 5.5,
        sellPrice: 14.9,
        stockQuantity: 35,
        warehouseLocation: "A1-02",
        sop_packing: "Fold 3x, insert thank-you card, polymailer M",
        weight: 240,
      },
      {
        sku: "CREW-HOOD-GR",
        name: "Crew Hoodie Grey",
        description: "Fleece hoodie with embroidery",
        costOfGoods: 16,
        sellPrice: 39.5,
        stockQuantity: 18,
        warehouseLocation: "B2-04",
        sop_packing: "Fold 2x, silica gel, box S",
        weight: 520,
      },
      {
        sku: "CAP-NV",
        name: "Washed Cap Navy",
        description: "Adjustable washed cotton cap",
        costOfGoods: 3.2,
        sellPrice: 12.9,
        stockQuantity: 60,
        warehouseLocation: "C1-07",
        sop_packing: "Bubble wrap brim, polymailer S",
        weight: 110,
      },
      {
        sku: "BAG-TOTE-NAT",
        name: "Canvas Tote Natural",
        description: "Heavy duty 12oz tote bag",
        costOfGoods: 2.8,
        sellPrice: 11.5,
        stockQuantity: 75,
        warehouseLocation: "C3-02",
        sop_packing: "Flat fold, polymailer S",
        weight: 180,
      },
    ];

    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const product of seedProducts) {
      const result = await ctx.runMutation((internal as any).inventory.seedInsert, {
        orgId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        costOfGoods: product.costOfGoods,
        sellPrice: product.sellPrice,
        stockQuantity: product.stockQuantity,
        warehouseLocation: product.warehouseLocation,
        sop_packing: product.sop_packing,
        weight: product.weight,
        createdBy: org.ownerId,
      });

      if (result?.created) {
        inserted.push(product.sku);
      } else {
        skipped.push(product.sku);
      }
    }

    return {
      success: true,
      inserted,
      skipped,
      message: `Seed completed. Added ${inserted.length}, skipped ${skipped.length}.`,
    };
  },
});

/**
 * Check order statistics for an organization
 * Usage: bunx convex run testing:checkOrderStats '{"orgId":"xxx"}'
 */
export const checkOrderStats = action({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    totalOrders: number;
    byStatus: Record<string, number>;
    totalRevenue: number;
    totalProfit: number;
    totalCost: number;
  }> => {
    const org: any = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const orders: any[] = await ctx.runQuery(internal.orders.listByOrg, { orgId: args.orgId });

    const stats: {
      totalOrders: number;
      byStatus: Record<string, number>;
      totalRevenue: number;
      totalProfit: number;
      totalCost: number;
    } = {
      totalOrders: orders.length,
      byStatus: {} as Record<string, number>,
      totalRevenue: 0,
      totalProfit: 0,
      totalCost: 0,
    };

    for (const order of orders) {
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
      if (order.status !== "cancelled") {
        stats.totalRevenue += order.totalPrice || 0;
        stats.totalProfit += order.totalProfit || 0;
        stats.totalCost += order.totalCost || 0;
      }
    }

    console.log("=== Order Statistics ===");
    console.log(`Organization: ${org.name} (${org.slug})`);
    console.log(`Total Orders: ${stats.totalOrders}`);
    console.log(`By Status:`, stats.byStatus);
    console.log(`Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
    console.log(`Total Cost: $${stats.totalCost.toFixed(2)}`);
    console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);

    return stats;
  },
});

/**
 * Clear all orders for an organization (DANGEROUS - use with caution)
 * Usage: bunx convex run testing:clearOrders '{"orgId":"xxx","confirm":true}'
 */
export const clearOrders = action({
  args: {
    orgId: v.id("organizations"),
    confirm: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    deleted: number;
    total: number;
    message: string;
  }> => {
    if (!args.confirm) {
      throw new Error("Must set confirm:true to proceed with deletion");
    }

    const org: any = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
    if (!org) throw new Error("Organization not found");

    const orders: any[] = await ctx.runQuery(internal.orders.listByOrg, { orgId: args.orgId });

    console.log(`=== Clearing ${orders.length} orders for ${org.name} ===`);

    let deleted = 0;
    for (const order of orders) {
      try {
        await ctx.runMutation(internal.orders.deleteOrder, { orderId: order._id });
        deleted++;
      } catch (e: any) {
        console.error(`Failed to delete order ${order._id}: ${e.message}`);
      }
    }

    console.log(`✅ Deleted ${deleted} out of ${orders.length} orders`);

    return {
      success: true,
      deleted,
      total: orders.length,
      message: `Cleared ${deleted} orders`,
    };
  },
});
