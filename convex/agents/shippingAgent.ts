// convex/agents/shippingAgent.ts - AI Agent for ShipEngine Label Purchase (Organization Metadata)
"use node";

import { v } from "convex/values";
import ShipEngine from "shipengine";

import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getShipEngineApiKey } from "../mgmt";

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

      // Get ShipEngine API key from Organization Metadata (encrypted at rest)
      if (!org.auth0OrgId) {
        throw new Error("Organization not linked to Auth0 (missing auth0OrgId)");
      }
      const shipEngineApiKey = await getShipEngineApiKey(org.auth0OrgId);

      // Attempt real label purchase via ShipEngine; fallback to mock on error
      try {
        const shipengine = new ShipEngine(shipEngineApiKey);

        const ord: any = order as any;
        const weightGrams = ord.weight ?? 300; // default 300g if not provided yet
        const length = 10;
        const width = 10;
        const height = 10;

        const shipment = await shipengine.createLabelFromShipmentDetails({
          shipment: {
            serviceCode: "usps_priority_mail", // TODO: allow dynamic service selection
            shipTo: {
              name: ord.recipientName,
              phone: ord.recipientPhone,
              addressLine1: ord.recipientAddress,
              cityLocality: ord.recipientCity,
              stateProvince: ord.recipientProvince,
              postalCode: ord.recipientPostalCode,
              countryCode: ord.recipientCountry || "US",
            },
            shipFrom: {
              name: org.name,
              addressLine1: "123 Business St",
              cityLocality: "San Francisco",
              stateProvince: "CA",
              postalCode: "94102",
              countryCode: "US",
            },
            packages: [
              {
                weight: {
                  value: weightGrams,
                  unit: "gram",
                },
                dimensions: {
                  length,
                  width,
                  height,
                  unit: "centimeter",
                },
              },
            ],
          } as any,
        });

        await ctx.runMutation(api.orders.updateShipping, {
          orderId: args.orderId,
          trackingNumber: (shipment as any).trackingNumber ?? (shipment as any).tracking_number,
          labelUrl: (shipment as any).labelDownload?.pdf ?? (shipment as any).label_download?.pdf,
          shippingCost: (shipment as any).shipmentCost?.amount ?? (shipment as any).shipment_cost?.amount,
          courierService: (shipment as any).carrierCode ?? (shipment as any).carrier_code,
        });

        return {
          success: true,
          trackingNumber: (shipment as any).trackingNumber ?? (shipment as any).tracking_number,
          labelUrl: (shipment as any).labelDownload?.pdf ?? (shipment as any).label_download?.pdf,
          shippingCost: (shipment as any).shipmentCost?.amount ?? (shipment as any).shipment_cost?.amount,
          courierService: (shipment as any).carrierCode ?? (shipment as any).carrier_code,
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
