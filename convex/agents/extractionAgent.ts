// convex/agents/extractionAgent.ts - LLM Data Extraction (for admin chat paste)

import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getUserOrgId } from "../auth";
import { requireOrgAccess } from "../security";
import { chatCompletion } from "../utils/llm";

// Extract order details from pasted chat text
export const extractOrderFromChat = action({
  args: {
    chatText: v.string(),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const resolvedOrgId = args.orgId ?? (await getUserOrgId(ctx));
    // Read-only action: enforce org membership, role restrictions are handled at UI layer
    await requireOrgAccess(ctx as any, resolvedOrgId as any);

    try {
      // Get products from this organization for product matching (server-side, no pricing leaked to client)
      const products = await ctx.runQuery(internal.inventory.listBasicForOrg, { orgId: resolvedOrgId });

      // Create product context for better matching
      const productContext = (products as any[]).map((p: any) => ({
        sku: p.sku,
        name: p.name,
        aliases: [p.name.toLowerCase(), p.sku.toLowerCase()], // Add any aliases here
      }));

      const systemPrompt = `You are an order data extraction specialist for WhatThePack. 
Extract order details from customer chat conversations.

Available products in this catalog:
${JSON.stringify(productContext, null, 2)}

Extract and return ONLY a JSON object with these exact fields:
{
  "customerName": "Full customer name",
  "customerPhone": "Phone number with country code if available",
  "recipientName": "Recipient name if different from customer",
  "recipientPhone": "Recipient phone if different",
  "address": "Complete street address",
  "city": "City name",
  "province": "State or province",
  "postalCode": "ZIP or postal code",
  "country": "Country code (2 letters)",
  "items": [
    {
      "sku": "Product SKU from catalog",
      "quantity": number,
      "notes": "Any specific notes about this item"
    }
  ],
  "notes": "Any additional order notes or special instructions",
  "paymentMethod": "Payment method mentioned",
  "paymentConfirmed": boolean,
  "confidence": number between 0-1
}

Rules:
1. Match products to catalog by name or SKU
2. If product not found in catalog, set sku to null and include in notes
3. Extract phone numbers with country code if available
4. Parse addresses carefully - separate street, city, province, postal
5. Set confidence based on how complete the information is
6. If critical information is missing (like address), set confidence below 0.7

Example chat to analyze:
"Hi, I want to order 2 Red T-Shirts (SKU: RT001) and 1 Blue Jeans. My name is John Smith, phone +1-555-0123. Send to Jane Doe, +1-555-0456. Address: 123 Main St, Apt 4B, New York, NY 10001, USA. I've paid via bank transfer. Thanks!"

Return ONLY the JSON object, no explanations.`;

      const result = await chatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract order details from this chat:\n\n${args.chatText}` },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const extractedText = result.content;
      if (!extractedText) {
        throw new Error("No response from AI model");
      }

      // Parse the JSON response
      let extractedData: any;
      try {
        extractedData = JSON.parse(extractedText);
      } catch (_parseError) {
        console.error("Failed to parse AI response as JSON:", extractedText);
        throw new Error("Failed to parse extracted data");
      }

      // Validate and clean the extracted data
      const cleanedData = validateExtractedData(extractedData, productContext);

      return {
        success: true,
        data: cleanedData,
        confidence: cleanedData.confidence,
        warnings: generateWarnings(cleanedData),
      };
    } catch (error: any) {
      console.error("Extraction error:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  },
});

// Validate and clean extracted data
function validateExtractedData(data: any, productContext: any[]): any {
  const cleaned = { ...data };

  // Clean phone numbers
  if (cleaned.customerPhone) {
    cleaned.customerPhone = cleanPhoneNumber(cleaned.customerPhone);
  }
  if (cleaned.recipientPhone) {
    cleaned.recipientPhone = cleanPhoneNumber(cleaned.recipientPhone);
  }

  // Validate items
  if (cleaned.items && Array.isArray(cleaned.items)) {
    cleaned.items = cleaned.items.map((item: any) => {
      const validatedItem = {
        sku: item.sku || null,
        name: item.name || null,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        notes: item.notes || "",
      };

      // Try to match product if SKU is null but name is provided
      if (!validatedItem.sku && validatedItem.name) {
        const match = findProductByName(validatedItem.name, productContext);
        if (match) {
          validatedItem.sku = match.sku;
          validatedItem.name = match.name;
        }
      }

      return validatedItem;
    });
  }

  // Set default confidence if not provided
  if (typeof cleaned.confidence !== "number") {
    cleaned.confidence = calculateConfidence(cleaned);
  }

  return cleaned;
}

// Clean and format phone numbers
function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If no country code and starts with US number pattern, add +1
  if (!cleaned.startsWith("+") && cleaned.length === 10) {
    cleaned = `+1${cleaned}`;
  }

  return cleaned;
}

// Find product by name (fuzzy matching)
function findProductByName(name: string, products: any[]): any | null {
  const searchName = name.toLowerCase().trim();

  // Exact match first
  let match = products.find((p) => p.name.toLowerCase() === searchName || p.sku.toLowerCase() === searchName);

  if (match) return match;

  // Fuzzy match
  match = products.find(
    (p) =>
      p.name.toLowerCase().includes(searchName) ||
      searchName.includes(p.name.toLowerCase()) ||
      p.aliases.some((alias: string) => alias.includes(searchName)),
  );

  return match || null;
}

// Calculate confidence score based on data completeness
function calculateConfidence(data: any): number {
  let score = 0;
  let totalChecks = 0;

  // Required fields
  const requiredFields = ["customerName", "address", "city", "province", "postalCode"];

  requiredFields.forEach((field) => {
    totalChecks++;
    if (data[field] && data[field].trim().length > 0) {
      score += 1;
    }
  });

  // Phone (optional but important)
  totalChecks++;
  if (data.customerPhone && data.customerPhone.length > 5) {
    score += 1;
  }

  // Items (critical)
  totalChecks += 2;
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    score += 1;
    if (data.items.every((item: any) => item.sku && item.quantity > 0)) {
      score += 1;
    }
  }

  return Math.min(1.0, score / totalChecks);
}

// Generate warnings for incomplete data
function generateWarnings(data: any): string[] {
  const warnings: string[] = [];

  if (!data.customerName || data.customerName.trim().length === 0) {
    warnings.push("Customer name is missing");
  }

  if (!data.address || data.address.trim().length === 0) {
    warnings.push("Street address is missing");
  }

  if (!data.city || data.city.trim().length === 0) {
    warnings.push("City is missing");
  }

  if (!data.postalCode || data.postalCode.trim().length === 0) {
    warnings.push("Postal code is missing");
  }

  if (!data.customerPhone || data.customerPhone.length < 5) {
    warnings.push("Customer phone number is missing or incomplete");
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    warnings.push("No items found in the order");
  } else {
    const invalidItems = data.items.filter((item: any) => !item.sku || item.quantity < 1);
    if (invalidItems.length > 0) {
      warnings.push(`${invalidItems.length} item(s) have missing SKU or invalid quantity`);
    }
  }

  if (data.confidence < 0.7) {
    warnings.push("Low confidence in extracted data - please review carefully");
  }

  return warnings;
}

// Quick validate product availability
export const validateProductAvailability = action({
  args: {
    items: v.array(
      v.object({
        sku: v.string(),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    validation: Array<{
      sku: string;
      available: boolean;
      name: string;
      stockQuantity: number;
      requestedQuantity: number;
      canFulfill: boolean;
    }>;
    canFulfillOrder: boolean;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userOrgId = await getUserOrgId(ctx);

    const validation: Array<{
      sku: string;
      available: boolean;
      name: string;
      stockQuantity: number;
      requestedQuantity: number;
      canFulfill: boolean;
    }> = [];

    for (const item of args.items) {
      if (!item.sku) continue;

      const product = await ctx.runQuery(api.inventory.getBySku, {
        orgId: userOrgId,
        sku: item.sku,
      });

      validation.push({
        sku: item.sku,
        available: !!product,
        name: product?.name || "Unknown Product",
        stockQuantity: product?.stockQuantity || 0,
        requestedQuantity: item.quantity,
        canFulfill: product ? product.stockQuantity >= item.quantity : false,
      });
    }

    return {
      validation,
      canFulfillOrder: validation.every((v: { available: boolean; canFulfill: boolean }) => v.available && v.canFulfill),
    };
  },
});
