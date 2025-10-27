import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

async function verifyVapiSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true; // allow in dev if not configured
  if (!signature) return false;

  try {
    // Use Web Crypto API instead of Node crypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (signature.length !== expected.length) return false;
    let matches = 0;
    for (let i = 0; i < signature.length; i++) {
      matches |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return matches === 0;
  } catch {
    return false;
  }
}

export const handleVapiWebhook = httpAction(async (ctx, request) => {
  try {
    const signature = request.headers.get("x-vapi-signature");
    const rawText = await request.text();

    if (!(await verifyVapiSignature(rawText, signature))) {
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawText);
    const { type, call, message } = body;

    switch (type) {
      case "function_call": {
        // Forward to regular Convex action for business logic
        const result = await ctx.runAction(internal.vapi.handleVapiFunctionCall, {
          call,
          message,
        });
        return Response.json(result);
      }
      case "call.started":
        console.log("VAPI call started:", call.id);
        return Response.json({ success: true });
      case "call.ended":
        console.log("VAPI call ended:", call.id);
        return Response.json({ success: true });
      default:
        return new Response(`Unknown event type: ${type}`, { status: 400 });
    }
  } catch (error: any) {
    console.error("VAPI webhook error:", error);
    return new Response(`Internal server error: ${error.message}`, { status: 500 });
  }
});
