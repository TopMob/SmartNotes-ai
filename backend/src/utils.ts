import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function stripHtml(value: string): string {
  if (!value) return "";
  let clean = value;
  clean = clean.replace(/<img[^>]*>/gi, " [Фото] ");
  clean = clean.replace(/\/api\/media\/google-drive\/download\?fileId=[a-zA-Z0-9-]+/g, " [Фото] ");
  return clean
    .replace(/<[^>]*>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeText(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function computeHashNode(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function getEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return new Array(384).fill(0);
  }
  const response = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ text: cleanText }),
  });
  if (response.ok) {
    const data = await response.json();
    if (data && Array.isArray(data.embedding)) {
      return data.embedding;
    }
  } else {
    const errText = await response.text();
    throw new Error(`Embedding status ${response.status}: ${errText}`);
  }
  throw new Error("Failed to get embedding from Supabase Edge Function");
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; max_tokens?: number; responseFormat?: { type: "json_object" | "text" } } = {}
): Promise<string> {
  let baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  baseUrl = baseUrl.replace(/\/+$/, "");

  if (!baseUrl.includes("openrouter.ai") && baseUrl.endsWith("/api/v1")) {
    baseUrl = baseUrl.slice(0, -7) + "/v1";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://smartnotes.app",
      "X-Title": "SmartNotes AI Backend",
    },
    body: JSON.stringify({
      model: options.model || defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1024,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI Gateway error ${response.status}: ${text}`);
  }

  const resJson = await response.json();
  return resJson.choices?.[0]?.message?.content || "";
}

export function cleanJsonResponse(text: string): string {
  let clean = text.trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  clean = clean.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const firstBracket = clean.indexOf("[");
  let startIdx = -1;
  let isObject = false;
  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      startIdx = firstBrace;
      isObject = true;
    } else {
      startIdx = firstBracket;
      isObject = false;
    }
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }
  let endIdx = -1;
  if (startIdx !== -1) {
    endIdx = isObject ? clean.lastIndexOf("}") : clean.lastIndexOf("]");
  }
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    clean = clean.substring(startIdx, endIdx + 1);
  }
  return clean.trim();
}

export function parseAiResponse(parsed: any) {
  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}
