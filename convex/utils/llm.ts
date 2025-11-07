// convex/utils/llm.ts - Minimal chat completion client using generic LLM API

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  // Optional per-call timeout override (ms)
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  raw: any;
}

function requireEnv(name: string): string {
  const val = (process.env as Record<string, string | undefined>)[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export async function chatCompletion(params: ChatParams): Promise<ChatResult> {
  const apiKey = requireEnv("LLM_API_KEY");
  const url = (process.env.LLM_API_URL || "https://integrate.api.nvidia.com/v1/chat/completions").trim();
  const model = (params.model || process.env.LLM_API_MODEL || "").trim();
  if (!model) throw new Error("Missing LLM_API_MODEL");

  const body: any = {
    model,
    messages: params.messages,
  };

  if (typeof params.temperature === "number") body.temperature = params.temperature;
  if (typeof params.top_p === "number") body.top_p = params.top_p;
  if (typeof params.max_tokens === "number") body.max_tokens = params.max_tokens;

  // Use a more realistic default timeout; allow per-call override and env override
  const timeoutMs = Number(params.timeoutMs ?? process.env.LLM_TIMEOUT_MS ?? 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    throw new Error(`LLM request error: ${err?.message || "unknown"}`);
  }
  clearTimeout(timeout);

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || res.statusText;
    throw new Error(`LLM request failed (${res.status}): ${msg}`);
  }

  const content: string | null = json?.choices?.[0]?.message?.content ?? null;
  if (!content || typeof content !== "string") {
    throw new Error("LLM response missing message content");
  }

  return { content, raw: json };
}

export function toPlainText(input: string): string {
  let s = input;
  // Remove bold/italics markers
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");
  s = s.replace(/\*(.*?)\*/g, "$1");
  s = s.replace(/_(.*?)_/g, "$1");
  // Strip headings
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Inline code/backticks
  s = s.replace(/`([^`]+)`/g, "$1");
  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");
  // Horizontal rules
  s = s.replace(/^\s*([-*_]){3,}\s*$/gm, "");
  // Excess spaces from list markers remain; keep bullets as-is
  return s.trim();
}
