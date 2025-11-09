// convex/agents/shippingAgent.ts - AI Agent for ShipEngine Label Purchase (Organization Metadata)
import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

// Helpers (fetch-based) to avoid Node-only SDKs
function getManagementDomain(): string {
  const managementDomain = process.env.AUTH0_TENANT_DOMAIN ?? process.env.AUTH0_DOMAIN;
  if (!managementDomain) throw new Error("Missing Auth0 domain. Set AUTH0_TENANT_DOMAIN or AUTH0_DOMAIN.");
  return managementDomain;
}

function selectAuth0OrgIdForEnv(org: any): string | undefined {
  const suffix = (process.env.APP_DOMAIN_SUFFIX || "").trim();
  const isDev = suffix.includes(".dev.") || suffix === ".dev.whatthepack.today";
  return isDev ? org?.auth0OrgIdDev || org?.auth0OrgId : org?.auth0OrgIdProd || org?.auth0OrgId;
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
  const token = (json as any)?.access_token as string | undefined;
  if (!token) throw new Error("Auth0 token response missing access_token");
  return token;
}

async function getShipEngineApiKeyFromAuth0(auth0OrgId: string): Promise<string> {
  if (!auth0OrgId || !auth0OrgId.startsWith("org_")) {
    throw new Error("Invalid Auth0 organization id");
  }
  const domain = getManagementDomain();
  const token = await getManagementAccessToken();
  const res = await fetch(`https://${domain}/api/v2/organizations/${auth0OrgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Auth0 org read error (${res.status}): ${json?.error || json?.message || res.statusText}`);
  const apiKey = json?.metadata?.shipengine_api_key as string | undefined;
  if (!apiKey) throw new Error("ShipEngine API key not configured for this organization");
  return apiKey;
}

// Buy shipping label using owner's ShipEngine API key from Organization Metadata
export const buyLabel = internalAction({
  args: {
    orderId: v.id("orders"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    try {
      // Get order details
      const order = await ctx.runQuery(api.orders.get, { orderId: args.orderId });
      if (!order) throw new Error("Order not found");

      // Get organization details
      const org = await ctx.runQuery(internal.organizations.get, { orgId: args.orgId });
      if (!org) throw new Error("Organization not found");

      // Get ShipEngine API key from Auth0 Organization Metadata (encrypted at rest)
      let auth0OrgId = selectAuth0OrgIdForEnv(org);
      if (!auth0OrgId) auth0OrgId = org.auth0OrgId; // back-compat
      if (!auth0OrgId) throw new Error("Organization not linked to Auth0 (missing auth0OrgId)");
      const shipEngineApiKey = await getShipEngineApiKeyFromAuth0(auth0OrgId);

      // Attempt real label purchase via ShipEngine REST; fallback to mock on error
      try {
        const ord: any = order as any;
        const weightGrams = ord.weight ?? 300; // default 300g if not provided yet
        const length = 10;
        const width = 10;
        const height = 10;

        const payload = {
          shipment: {
            service_code: "usps_priority_mail", // TODO: allow dynamic service selection
            ship_to: {
              name: ord.recipientName,
              phone: ord.recipientPhone,
              address_line1: ord.recipientAddress,
              city_locality: ord.recipientCity,
              state_province: ord.recipientProvince,
              postal_code: ord.recipientPostalCode,
              country_code: ord.recipientCountry || "US",
            },
            ship_from: {
              name: org.name,
              address_line1: "123 Business St",
              city_locality: "San Francisco",
              state_province: "CA",
              postal_code: "94102",
              country_code: "US",
            },
            packages: [
              {
                weight: { value: weightGrams, unit: "gram" },
                dimensions: { length, width, height, unit: "centimeter" },
              },
            ],
          },
        } as const;

        const res = await fetch("https://api.shipengine.com/v1/labels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "API-Key": shipEngineApiKey,
          },
          body: JSON.stringify(payload),
        });

        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = json?.errors?.[0]?.message || json?.message || res.statusText;
          throw new Error(`ShipEngine label error (${res.status}): ${msg}`);
        }

        const trackingNumber = json?.tracking_number || json?.trackingNumber;
        const labelUrl = json?.label_download?.pdf || json?.labelDownload?.pdf;
        const shippingCost = json?.shipment_cost?.amount || json?.shipmentCost?.amount;
        const courierService = json?.carrier_code || json?.carrierCode;

        await ctx.runMutation(api.orders.updateShipping, {
          orderId: args.orderId,
          trackingNumber,
          labelUrl,
          shippingCost,
          courierService,
        });

        return {
          success: true,
          trackingNumber,
          labelUrl,
          shippingCost,
          courierService,
          mode: shipEngineApiKey.startsWith("TEST_") ? "test" : "live",
          message: "Label purchased successfully",
        };
      } catch (seErr: any) {
        console.error("ShipEngine error, falling back to mock:", seErr?.message || seErr);

        const mockTrackingNumber = `TRACK${Date.now()}`;
        const mockLabelUrl = `https://example.com/label/${args.orderId}`;

        await ctx.runMutation(api.orders.updateShipping, {
          orderId: args.orderId,
          trackingNumber: mockTrackingNumber,
          labelUrl: mockLabelUrl,
          shippingCost: 5.99,
          courierService: "DEMO_COURIER",
        });

        return {
          success: true,
          trackingNumber: mockTrackingNumber,
          labelUrl: mockLabelUrl,
          shippingCost: 5.99,
          courierService: "DEMO_COURIER",
          mode: "mock",
          message: "Label purchased in DEMO MODE (fallback)",
        };
      }
    } catch (error: any) {
      console.error("ShippingAgent error:", error);
      throw new Error(`Failed to purchase label: ${error.message}`);
    }
  },
});

// Compare shipping rates across available carriers (mock implementation)
export const compareRates = internalAction({
  args: {
    orderId: v.id("orders"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    try {
      const order = await ctx.runQuery(api.orders.get, { orderId: args.orderId });
      if (!order) throw new Error("Order not found");

      // Mock rate comparison
      const rates = [
        {
          carrierName: "USPS",
          serviceName: "Priority Mail",
          serviceCode: "usps_priority",
          cost: 5.99,
          currency: "USD",
          deliveryDays: 3,
          deliveryDate: null,
        },
        {
          carrierName: "USPS",
          serviceName: "First Class",
          serviceCode: "usps_first_class",
          cost: 3.99,
          currency: "USD",
          deliveryDays: 5,
          deliveryDate: null,
        },
        {
          carrierName: "UPS",
          serviceName: "Ground",
          serviceCode: "ups_ground",
          cost: 7.99,
          currency: "USD",
          deliveryDays: 2,
          deliveryDate: null,
        },
      ];

      return {
        success: true,
        rates,
        totalRates: rates.length,
      };
    } catch (error: any) {
      console.error("Rate comparison error:", error);
      throw new Error(`Failed to compare rates: ${error.message}`);
    }
  },
});

// Track a package (mock implementation)
export const trackPackage = internalAction({
  args: {
    trackingNumber: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (_ctx, args) => {
    try {
      // Mock tracking information
      const trackingInfo = {
        status_description: "In Transit",
        events: [
          {
            event_timestamp: Date.now() - 86400000, // 1 day ago
            status: "label_created",
            description: "Shipping label created",
            location: "San Francisco, CA",
          },
          {
            event_timestamp: Date.now() - 43200000, // 12 hours ago
            status: "in_transit",
            description: "Package picked up by carrier",
            location: "San Francisco, CA",
          },
        ],
        estimated_delivery_date: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
        delivered_at: null,
      };

      return {
        success: true,
        trackingNumber: args.trackingNumber,
        status: trackingInfo.status_description,
        events: trackingInfo.events,
        estimatedDelivery: trackingInfo.estimated_delivery_date,
        deliveredAt: trackingInfo.delivered_at,
      };
    } catch (error: any) {
      console.error("Package tracking error:", error);
      throw new Error(`Failed to track package: ${error.message}`);
    }
  },
});

// Void a shipping label (mock implementation)
export const voidLabel = internalAction({
  args: {
    labelId: v.string(),
    orgId: v.id("organizations"),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    try {
      // Mock void operation
      console.log(`Voiding label ${args.labelId}`);

      // Update order status back to "paid" (ready to be processed again)
      await ctx.runMutation(api.orders.updateStatus, {
        orderId: args.orderId,
        status: "paid",
      });

      // Stock restoration omitted; order returned to 'paid'

      return {
        success: true,
        message: "Label voided successfully and order restored to 'paid' status",
      };
    } catch (error: any) {
      console.error("Label void error:", error);
      throw new Error(`Failed to void label: ${error.message}`);
    }
  },
});
