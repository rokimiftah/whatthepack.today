import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { requireRole } from "./auth";

// VAPI tool definitions
export const VAPI_TOOLS = {
  get_next_order: {
    description: "Get the next order to pack",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  complete_order: {
    description: "Mark an order as completed with weight",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID to complete" },
        weight: { type: "number", description: "Package weight in grams" },
      },
      required: ["orderId", "weight"],
    },
  },
  report_stockout: {
    description: "Report a product as out of stock",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Product SKU that is out of stock" },
      },
      required: ["sku"],
    },
  },
  check_stock: {
    description: "Check stock level for a product",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Product SKU to check" },
      },
      required: ["sku"],
    },
  },
  get_packing_instructions: {
    description: "Get packing instructions for a product",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Product SKU for packing instructions" },
      },
      required: ["sku"],
    },
  },
  get_daily_briefing: {
    description: "Get daily business briefing (owners only)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  ask_question: {
    description: "Ask a general question about the business",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "Your question" },
      },
      required: ["question"],
    },
  },
};

const PACKER_ASSISTANT_PROMPT = [
  'You are "WhatThePack Packer Assistant", a calm, reliable warehouse voice.',
  "",
  "OBJECTIVE",
  "- Help packers process paid orders for the correct organization.",
  "- Execute actions only when orgId from call metadata matches the current tenant.",
  "",
  "GUARDRAILS",
  "- If metadata is missing orgId, ask the packer to re-authenticate and end the session.",
  "- Reject any request that references another organization.",
  "- Do not disclose financial metrics; redirect those questions to the owner dashboard.",
  "",
  "FLOW",
  "1. Greet the packer by name, confirm you will fetch paid orders.",
  '2. When asked to get the next order, call tool ask_question with payload {"intent": "get_next_order", "question": "Next paid order for packing", "orgId": <metadata.orgId> }.',
  "3. Read back the order summary: order number, recipient, each item (quantity, SKU, bin location), special notes.",
  "4. If the packer reports a stockout, call tool intent report_stockout and include the SKU.",
  "5. When packing is complete, confirm weight/notes and call tool intent complete_order.",
  "6. If the tool returns a tracking number, announce it and remind the packer to affix the label.",
  '7. Close with: "Order complete. Ready for the next one."',
  "",
  "ERROR HANDLING",
  "- If a tool returns an error, summarize it briefly and suggest retrying or escalating to an admin.",
  '- If no paid orders exist, respond: "No paid orders in queue right now; I’ll wait for the next one."',
  "",
  "STYLE",
  "- Use concise, professional English sentences.",
  "- Pause briefly so the packer can respond.",
].join("\n");

const PACKER_ASSISTANT_FUNCTIONS = Object.entries(VAPI_TOOLS).map(([name, definition]) => ({
  name,
  description: definition.description,
  parameters: definition.parameters,
}));

const PACKER_TOOLS_HTTP_CONFIG = [
  {
    name: "ask_question",
    description: "Queries Convex to fetch or answer questions about the business",
    intent: "ask_question",
  },
  {
    name: "complete_order",
    description: "Marks an order as completed and triggers label purchase",
    intent: "complete_order",
  },
  {
    name: "report_stockout",
    description: "Reports a SKU as out of stock",
    intent: "report_stockout",
  },
  {
    name: "get_next_order",
    description: "Returns the next paid order ready for packing",
    intent: "get_next_order",
  },
];

const DEFAULT_VAPI_BASE_URL = "https://api.vapi.ai/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function resolveServerUrl(): string {
  const explicit = process.env.VAPI_SERVER_URL;
  if (explicit) return explicit;

  const convexSite = process.env.CONVEX_SITE_URL;
  if (!convexSite) {
    throw new Error("Set VAPI_SERVER_URL or CONVEX_SITE_URL to compute assistant server URL");
  }
  return `${convexSite.replace(/\/$/, "")}/vapi`;
}

// Sync or create the packer assistant via Vapi Management API
export const syncPackerAssistant = action({
  args: {
    orgId: v.id("organizations"),
    forceRecreate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.orgId, ["owner"]);

    const secretKey = requireEnv("VAPI_SECRET_KEY");
    const baseUrl = process.env.VAPI_API_BASE_URL ?? DEFAULT_VAPI_BASE_URL;
    const assistantName = process.env.VAPI_ASSISTANT_NAME ?? "WhatThePack Packer Assistant";
    const voiceId = process.env.VAPI_VOICE_ID ?? "voice_default";
    const backgroundSoundUrl = process.env.VAPI_BACKGROUND_SOUND_URL;
    const transcriberModel = process.env.VAPI_TRANSCRIBER_MODEL ?? "nova-2";
    const transcriberLanguage = process.env.VAPI_TRANSCRIBER_LANGUAGE ?? "en";
    const firstMessage = process.env.VAPI_FIRST_MESSAGE ?? "Hello.";
    const serverUrl = resolveServerUrl();

    const org = (await ctx.runQuery(internal.organizations.get, { orgId: args.orgId })) as any;
    if (!org) {
      throw new Error("Organization not found");
    }

    const voicePayload: Record<string, unknown> = {
      provider: "vapi",
      voiceId,
    };
    if (backgroundSoundUrl) {
      voicePayload.backgroundSoundUrl = backgroundSoundUrl;
    }

    const assistantPayload: Record<string, unknown> = {
      organizationId: args.orgId,
      name: assistantName,
      model: {
        provider: "openai",
        model: "gpt-4.1-nano",
        temperature: 0.5,
      },
      firstMessage: {
        mode: "assistant_first",
        content: firstMessage,
      },
      instructions: PACKER_ASSISTANT_PROMPT,
      functions: PACKER_ASSISTANT_FUNCTIONS,
      voice: voicePayload,
      transcriber: {
        provider: "deepgram",
        model: transcriberModel,
        language: transcriberLanguage,
        backgroundDenoisingEnabled: true,
        confidenceThreshold: 0.4,
      },
      settings: {
        maxTokens: 250,
        inputMinCharacters: 30,
        startSpeaking: { waitSeconds: 0.4 },
        stopSpeaking: {
          voiceSeconds: 0.2,
          backOffSeconds: 1,
        },
      },
      server: {
        url: serverUrl,
        secret: requireEnv("VAPI_WEBHOOK_SECRET"),
      },
    };

    const existingAssistantId = args.forceRecreate ? undefined : org.vapiAssistantId;
    const assistantEndpoint = existingAssistantId ? `${baseUrl}/assistants/${existingAssistantId}` : `${baseUrl}/assistants`;
    const method = existingAssistantId ? "PATCH" : "POST";

    const assistantResponse = await fetch(assistantEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assistantPayload),
    });

    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      throw new Error(`Failed to sync Vapi assistant (${assistantResponse.status}): ${errorText}`);
    }

    const assistantBody: any = await assistantResponse.json();
    const assistantId = assistantBody?.id ?? assistantBody?.data?.id ?? existingAssistantId;
    if (!assistantId) {
      throw new Error("Unable to determine assistant ID from Vapi response");
    }

    if (assistantId !== org.vapiAssistantId) {
      await ctx.runMutation((internal as any).organizations.setVapiAssistantId, {
        orgId: args.orgId,
        assistantId,
      });
    }

    // Ensure HTTP tools exist
    let existingTools: any[] = [];
    try {
      const toolsResponse = await fetch(`${baseUrl}/assistants/${assistantId}/tools`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });
      if (toolsResponse.ok) {
        const parsed = await toolsResponse.json();
        existingTools = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
      }
    } catch (error) {
      console.warn("Failed to fetch existing Vapi tools", error);
    }

    const existingToolNames = new Set(
      existingTools.map((tool: any) => tool?.name).filter((name: unknown): name is string => typeof name === "string"),
    );

    for (const tool of PACKER_TOOLS_HTTP_CONFIG) {
      if (existingToolNames.has(tool.name)) continue;

      const toolPayload = {
        organizationId: args.orgId,
        assistantId,
        name: tool.name,
        description: tool.description,
        type: "http",
        config: {
          url: serverUrl,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      };

      const toolResponse = await fetch(`${baseUrl}/tools`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toolPayload),
      });

      if (!toolResponse.ok) {
        const toolError = await toolResponse.text();
        console.warn(`Failed to register Vapi tool ${tool.name}: ${toolError}`);
      }
    }

    return {
      success: true,
      assistantId,
      organizationId: args.orgId,
      serverUrl,
      voiceId,
    };
  },
});

// Main VAPI function call handler (internal action called from Node HTTP handler)
export const handleVapiFunctionCall = internalAction({
  args: {
    call: v.any(),
    message: v.any(),
  },
  handler: async (ctx, { call, message }) => {
    return handleFunctionCall(ctx, call, message);
  },
});

// Handle function calls from VAPI
async function handleFunctionCall(ctx: any, call: any, message: any) {
  const { function_call } = message;
  const { name, arguments: args, tool_call_id } = function_call;

  console.log("VAPI function call:", name, args);

  try {
    let result: any;

    switch (name) {
      case "get_next_order":
        result = await handleGetNextOrder(ctx, call);
        break;

      case "complete_order":
        result = await handleCompleteOrder(ctx, call, args);
        break;

      case "report_stockout":
        result = await handleReportStockout(ctx, call, args);
        break;

      case "check_stock":
        result = await handleCheckStock(ctx, call, args);
        break;

      case "get_packing_instructions":
        result = await handleGetPackingInstructions(ctx, call, args);
        break;

      case "get_daily_briefing":
        result = await handleGetDailyBriefing(ctx, call);
        break;

      case "ask_question":
        result = await handleAskQuestion(ctx, call, args);
        break;

      default:
        throw new Error(`Unknown function: ${name}`);
    }

    // Return response in VAPI format
    return Response.json({
      results: [
        {
          tool_call_id,
          result: JSON.stringify(result),
        },
      ],
    });
  } catch (error: any) {
    console.error(`Error in ${name}:`, error);

    return Response.json({
      results: [
        {
          tool_call_id,
          result: JSON.stringify({
            error: error.message,
            success: false,
          }),
        },
      ],
    });
  }
}

// Get next order to pack
async function handleGetNextOrder(ctx: any, call: any) {
  // Extract orgId from call metadata or user ID
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  // Verify user has packer role
  await requireRole(ctx, orgId, ["packer", "admin", "owner"]);

  // Get next paid order
  const nextOrder = await ctx.runQuery(api.orders.getNextOrder as any, { orgId });

  if (!nextOrder) {
    return {
      success: true,
      message: "No orders are currently ready for packing.",
      order: null,
    };
  }

  // Format order details for voice response
  const itemsText = nextOrder.items?.map((item: any) => `${item.quantity} ${item.productName}`).join(", ") || "No items";

  return {
    success: true,
    message: `Order ${nextOrder.orderNumber}. Customer: ${nextOrder.recipientName}. Items: ${itemsText}. Address: ${nextOrder.recipientAddress}, ${nextOrder.recipientCity}.`,
    order: {
      id: nextOrder._id,
      orderNumber: nextOrder.orderNumber,
      recipientName: nextOrder.recipientName,
      items: nextOrder.items,
      address: `${nextOrder.recipientAddress}, ${nextOrder.recipientCity}`,
      specialInstructions: nextOrder.specialInstructions,
    },
  };
}

// Complete order and purchase shipping label
async function handleCompleteOrder(ctx: any, call: any, args: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  await requireRole(ctx, orgId, ["packer", "admin", "owner"]);

  const { orderId } = args;

  // Update order status to processing
  await ctx.runMutation(api.orders.updateStatus as any, {
    orderId,
    status: "processing",
  });

  // Purchase shipping label
  const shippingResult = await ctx.runAction((internal as any)["agents/shippingAgent"].buyLabel, {
    orderId,
    orgId,
  });

  if (shippingResult.success) {
    return {
      success: true,
      message: `Label purchased successfully. Tracking number: ${shippingResult.trackingNumber}. Order ${shippingResult.trackingNumber} is now shipped.`,
      trackingNumber: shippingResult.trackingNumber,
      courier: shippingResult.courierService,
    };
  } else {
    throw new Error("Failed to purchase shipping label");
  }
}

// Report stockout
async function handleReportStockout(ctx: any, call: any, args: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  await requireRole(ctx, orgId, ["packer", "admin", "owner"]);

  const { sku } = args;

  // Find the product
  const product = await ctx.runQuery(api.inventory.getBySku, { orgId, sku });
  if (!product) {
    throw new Error(`Product with SKU ${sku} not found`);
  }

  // Stock update omitted (packer reports; owner/admin to adjust)

  // Send stock alert notification
  await ctx.runAction((internal as any)["agents/notificationAgent"].sendStockAlert, {
    orgId,
    productId: product._id,
    reporterId: call.metadata?.userId,
    currentStock: 0,
  });

  return {
    success: true,
    message: `Stock alert sent for ${product.name} (${sku}). The owner and admin have been notified.`,
    product: {
      sku: product.sku,
      name: product.name,
    },
  };
}

// Check stock level
async function handleCheckStock(ctx: any, call: any, args: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  await requireRole(ctx, orgId, ["packer", "admin", "owner"]);

  const { sku } = args;

  const product = await ctx.runQuery(api.inventory.getBySku, { orgId, sku });
  if (!product) {
    throw new Error(`Product with SKU ${sku} not found`);
  }

  const stockStatus = product.stockQuantity === 0 ? "out of stock" : product.stockQuantity <= 5 ? "low stock" : "in stock";

  return {
    success: true,
    message: `${product.name} (${sku}) has ${product.stockQuantity} units in stock. Status: ${stockStatus}.`,
    product: {
      sku: product.sku,
      name: product.name,
      stockQuantity: product.stockQuantity,
      location: product.warehouseLocation,
      status: stockStatus,
    },
  };
}

// Get packing instructions
async function handleGetPackingInstructions(ctx: any, call: any, args: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  await requireRole(ctx, orgId, ["packer", "admin", "owner"]);

  const { sku } = args;

  const instructions = await ctx.runQuery((api as any)["agents/ragAgent"].getPackingInstructions, {
    sku,
  });

  return {
    success: true,
    message: instructions.sop_packing || "No specific packing instructions available.",
    instructions: {
      sku: instructions.sku,
      name: instructions.name,
      sop_packing: instructions.sop_packing,
      location: instructions.warehouseLocation,
      stockQuantity: instructions.stockQuantity,
    },
  };
}

// Get daily briefing (owners only)
async function handleGetDailyBriefing(ctx: any, call: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  await requireRole(ctx, orgId, ["owner"]);

  // Use the new briefingAgent to generate comprehensive briefing
  const briefingResult = await ctx.runQuery((api as any)["agents/briefingAgent"].generateDailyBriefing, {
    orgId,
  });

  // Extract key info for voice response (concise)
  const data = briefingResult.data;
  let message = `Good morning. Today you have ${data.today.orders} orders`;

  if (data.today.orders > 0) {
    message += `, with revenue of $${data.today.revenue.toFixed(2)} and profit of $${data.today.profit.toFixed(2)}`;
  }
  message += ".";

  if (data.alerts.pendingOrders > 0) {
    message += ` You have ${data.alerts.pendingOrders} orders pending packing.`;
  }

  if (data.alerts.lowStock.length > 0) {
    const productNames = data.alerts.lowStock
      .slice(0, 3)
      .map((p: any) => p.name)
      .join(", ");
    message += ` Low stock alert: ${productNames} need reordering.`;
  }

  return {
    success: true,
    message,
    briefing: briefingResult.briefing, // Full LLM-generated briefing
    data: briefingResult.data,
  };
}

// Ask general question (RAG or Business Analyst)
async function handleAskQuestion(ctx: any, call: any, args: any) {
  const orgId = call.metadata?.orgId;
  if (!orgId) {
    throw new Error("Organization ID not found in call metadata");
  }

  const { question } = args;

  // Check if this is an analytical question (for owners)
  const analyticalKeywords = [
    "sales",
    "revenue",
    "profit",
    "trend",
    "performance",
    "best",
    "worst",
    "top",
    "analyze",
    "forecast",
    "compare",
    "margin",
  ];

  const isAnalytical = analyticalKeywords.some((keyword) => question.toLowerCase().includes(keyword));

  // Try to get user role from metadata
  const userRole = call.metadata?.userRole || "unknown";

  // Use Business Analyst for analytical questions from owners
  if (isAnalytical && userRole === "owner") {
    try {
      const analysis = await ctx.runAction((api as any)["agents/analystAgent"].analyzeBusinessData, {
        query: question,
        orgId,
      });

      return {
        success: true,
        message: analysis.analysis,
        type: "analysis",
      };
    } catch (error: any) {
      console.error("Business analyst error, falling back to RAG:", error);
      // Fall through to RAG
    }
  }

  // Use RAG for general questions
  const response = await ctx.runQuery((api as any)["agents/ragAgent"].answerQuery, {
    prompt: question,
    orgId,
  });

  return {
    success: true,
    message: response.response,
    role: response.role,
    type: "rag",
  };
}
