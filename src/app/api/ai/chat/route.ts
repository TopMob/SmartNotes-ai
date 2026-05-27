import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { openRouterComplete } from "@/shared/api/openrouter/openrouter-client";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { getEmbedding } from "@/shared/lib/ai/local-embeddings";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const CHAT_SYSTEM_PROMPT = `You are a personal AI assistant for the SmartNotes app.
You ONLY answer based on the user's notes provided below. Do NOT use external knowledge.
If the answer is not found in the notes, say so honestly.
Always cite which note(s) your answer comes from using [Note: "title"] format.
Be concise, helpful, and use the same language as the question.
Respond in plain text (no markdown code blocks).`;

interface EmbeddingMatch {
  note_id: string;
  note_title?: string;
  content: string;
}

export async function POST(request: Request) {

  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const { question } = (await request.json()) as { question: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400, headers: CORS_HEADERS });
  }


  const cookieStore = await cookies();
  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
  );

  let chunks: EmbeddingMatch[] = [];
  try {
    const questionEmbedding = await getEmbedding(question);
    const { data, error } = await supabase.rpc("match_note_embeddings", {
      query_embedding: questionEmbedding,
      match_threshold: 0.15, // minimum similarity score
      match_count: 6,
      p_owner_id: userId
    });
    
    if (error) throw error;
    chunks = (data as EmbeddingMatch[]) || [];
  } catch (error) {
    console.error("Vector matching failed:", error);
    return NextResponse.json({ error: "Failed to search vector embeddings" }, { status: 500, headers: CORS_HEADERS });
  }

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: "По твоим заметкам я не нашёл информации по этому запросу. Попробуй сформулировать иначе.",
      citations: [],
    }, { headers: CORS_HEADERS });
  }

  const context = chunks.map((chunk, i) =>
    `[Note ${i + 1}: "${chunk.note_title || "Без названия"}"]\n${chunk.content}`
  ).join("\n\n---\n\n");

  const userPrompt = `User's notes:\n\n${context}\n\n---\n\nQuestion: ${question}`;


  let answer: string;
  try {
    answer = await openRouterComplete(CHAT_SYSTEM_PROMPT, userPrompt, { response_format: { type: "text" }, max_tokens: 1024 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // Deduplicate citations by note_id
  const citations = chunks
    .map((chunk) => ({ id: chunk.note_id, title: chunk.note_title || "Без названия" }))
    .filter((val, index, self) => self.findIndex(t => t.id === val.id) === index);

  return NextResponse.json({
    answer,
    citations,
  }, { headers: CORS_HEADERS });
}
