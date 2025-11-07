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
        aliases: [p.name.toLowerCase(), p.sku.toLowerCase()],
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

      let llmError: Error | null = null;
      let extractedData: any | null = null;
      try {
        const result = await chatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Extract order details from this chat:\n\n${args.chatText}` },
          ],
          temperature: 0.1,
          max_tokens: 1000,
          timeoutMs: 20000,
        });

        const extractedText = result.content;
        if (!extractedText) throw new Error("No response from AI model");
        extractedData = safeParseFlexibleJson(extractedText);
      } catch (e: any) {
        llmError = e instanceof Error ? e : new Error(String(e));
      }

      // Fallback: deterministic parser over raw chat
      if (!extractedData) {
        const fallbackData = fallbackExtractOrder(args.chatText, productContext);
        const cleanedFallback = validateExtractedData(fallbackData, productContext);
        const warnings = generateWarnings(cleanedFallback);
        if (llmError) warnings.unshift(`LLM extraction failed; used deterministic parser: ${llmError.message}`);
        return {
          success: true,
          data: cleanedFallback,
          confidence: cleanedFallback.confidence,
          warnings,
        };
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
      // As last resort, try minimal fallback without product catalog
      try {
        const minimal = fallbackExtractOrder(args.chatText, []);
        const cleaned = validateExtractedData(minimal, []);
        return {
          success: true,
          data: cleaned,
          confidence: cleaned.confidence,
          warnings: ["Severe fallback mode used due to unexpected error"].concat(generateWarnings(cleaned)),
        };
      } catch (_) {
        return {
          success: false,
          error: error.message,
          data: null,
        };
      }
    }
  },
});

// Try to extract a valid JSON object string from LLM output
function extractJsonString(s: string): string {
  const trimmed = s.trim();
  // Handle fenced code blocks ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // If it already looks like pure JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  // Fallback: grab from first { to last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed; // Let JSON.parse throw; upstream will handle
}

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

  // Normalize Indonesian numbers (e.g., 08xx -> +62 8xx)
  if (!cleaned.startsWith("+") && /^0\d{8,14}$/.test(cleaned)) {
    cleaned = `+62${cleaned.slice(1)}`;
  } else if (!cleaned.startsWith("+") && /^62\d{8,14}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }

  // Fallback for plain 10-digit numbers (assume +1)
  if (!cleaned.startsWith("+") && cleaned.length === 10) cleaned = `+1${cleaned}`;

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

  const val = Math.min(1.0, score / totalChecks);
  return Number.isFinite(val) ? val : 0;
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

// Flexible JSON parsing that tolerates fenced blocks, stray text, single quotes, and trailing commas
function safeParseFlexibleJson(text: string): any | null {
  const candidate = extractJsonString(text);
  // Try strict first
  try {
    return JSON.parse(candidate);
  } catch {}
  // Remove trailing commas
  let s = candidate.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(s);
  } catch {}
  // Replace single quotes with double quotes when likely JSON
  const looksLikeJson = /[{[]/.test(s);
  if (looksLikeJson) {
    s = s
      // quote unquoted keys: { key: value } -> { "key": value }
      .replace(/([,{\s])([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      // replace single-quoted strings with double quotes
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    try {
      return JSON.parse(s);
    } catch {}
  }
  return null;
}

// Deterministic fallback extraction from raw chat text
function fallbackExtractOrder(chatText: string, productContext: any[]) {
  const raw = chatText.replace(/\r/g, "");
  const lines = raw.split("\n");
  const lower = raw.toLowerCase();

  const getField = (keys: string[]) => {
    for (const line of lines) {
      for (const key of keys) {
        const idx = line.toLowerCase().indexOf(key);
        if (idx !== -1) {
          const val = line
            .slice(idx + key.length)
            .replace(/^\s*[:-]\s*/, "")
            .trim();
          if (val) return val;
        }
      }
    }
    return "";
  };

  // Address block: capture after a line starting with Address/Alamat until next known label
  const addressLabels = ["address", "alamat"]; // EN/ID
  let address = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (addressLabels.some((k) => l.toLowerCase().startsWith(k))) {
      const first = l.split(/:/).slice(1).join(":").trim();
      const buf = [first].filter(Boolean);
      for (let j = i + 1; j < lines.length; j++) {
        const nl = lines[j].trim();
        if (!nl) break;
        const isNextField = /^(courier|payment|note|catatan|recipient|nama|phone|telepon)/i.test(nl);
        if (isNextField) break;
        buf.push(nl);
      }
      address = buf.join(" ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  const recipientName = getField(["recipient's name", "recipient", "nama penerima", "penerima"]);
  const customerName = getField(["name", "customer", "pemesan", "nama"]);
  const recipientPhone = getField(["recipient's phone", "phone", "telepon", "hp", "wa", "whatsapp"]);
  const customerPhone = getField(["customer phone", "phone", "telepon", "hp", "wa", "whatsapp"]);
  const _courier = getField(["courier", "kurir"]);
  const paymentMethod = getField(["payment", "pembayaran", "method", "metode"]);

  // Notes
  let notes = getField(["note", "catatan"]);
  if (_courier) notes = notes ? `${notes} | Courier: ${_courier}` : `Courier: ${_courier}`;

  // Items block
  const items: Array<{ name: string; quantity: number; sku: string | null; notes?: string }> = [];
  const itemsStart = lines.findIndex((l) => /^\s*(items|barang|order|pesanan)\s*:/i.test(l));
  const itemLineRe = /^\s*(?:[-•*\d+.)]+\s*)?(.+?)(?:\s*[x×]\s*(\d+)|\s*\((\d+)[^)]+\))?\s*$/i;
  const pushItem = (rawLine: string) => {
    const m = rawLine.match(itemLineRe);
    if (!m) return;
    const name = (m[1] || "").trim();
    const qty = Number(m[2] || m[3] || 1);
    if (!name) return;
    const match = findProductByName(name, productContext);
    items.push({ name, quantity: Math.max(1, qty || 1), sku: match?.sku ?? null });
  };

  if (itemsStart !== -1) {
    for (let i = itemsStart + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) break;
      const isNextField = /^(courier|payment|note|catatan|recipient|nama|phone|telepon)/i.test(l.trim());
      if (isNextField) break;
      if (/^\s*[-•*\d+.)]/.test(l) || l.trim().length > 0) pushItem(l);
    }
  } else {
    // Fallback: parse any bullet-like lines in chat
    for (const l of lines) {
      if (/^\s*[-•*]/.test(l)) pushItem(l);
    }
  }

  // City / postal / province heuristic from address
  let city = "";
  let province = "";
  let postalCode = "";
  const postalMatch = address.match(/(^|\D)(\d{5})(?!\d)/);
  if (postalMatch) postalCode = postalMatch[2];
  if (/dki jakarta/i.test(address)) province = "DKI Jakarta";
  const cityMatch = address.match(/([A-Za-z ]+?)\s*,\s*\d{5}/);
  if (cityMatch) city = cityMatch[1].trim();

  // Country inference
  let country = "";
  if (/\b(indonesia|id)\b/i.test(lower) || /(^|\D)0\d{8,14}(\D|$)/.test(raw)) country = "ID";

  const result = {
    customerName: recipientName || customerName || "",
    customerPhone: customerPhone || recipientPhone || "",
    recipientName: recipientName || "",
    recipientPhone: recipientPhone || "",
    address,
    city,
    province,
    postalCode,
    country: country || "",
    items,
    notes,
    paymentMethod,
    paymentConfirmed: /paid|lunas|transfer selesai|sudah bayar/i.test(lower),
  } as any;

  result.confidence = calculateConfidence(result);
  return result;
}
