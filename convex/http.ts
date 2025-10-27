// convex/http.ts - HTTP Routes for WhatThePack

import { httpRouter } from "convex/server";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handleVapiWebhook } from "./vapi_node";

const http = httpRouter();

// Auth routes
auth.addHttpRoutes(http);

// VAPI webhook endpoint for voice commands
http.route({
  path: "/vapi",
  method: "POST",
  handler: handleVapiWebhook,
});

// Provision endpoint for Auth0 Post-Registration
http.route({
  path: "/provision",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify webhook secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CONVEX_WEBHOOK_SECRET;

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { userId, email, name } = body;

    // Create organization and user
    const orgName = name || email.split("@")[0];
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Create user in Convex
    const convexUserId = await ctx.runMutation(api.users.createFromAuth0, {
      auth0Id: userId,
      email,
      name,
      role: "owner",
    });

    // Create organization
    const orgId = await ctx.runMutation(api.organizations.create, {
      name: orgName,
      slug: orgSlug,
      ownerId: convexUserId,
      ownerAuth0Id: userId,
    });

    // Link user to org
    await ctx.runMutation(api.users.updateOrg, {
      userId: convexUserId,
      orgId,
    });

    return Response.json({
      success: true,
      organizationId: orgId,
      organizationName: orgName,
      organizationSlug: orgSlug,
      userId: convexUserId,
    });
  }),
});

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return Response.json({
      status: "ok",
      timestamp: Date.now(),
      service: "WhatThePack.today API",
    });
  }),
});

export default http;
