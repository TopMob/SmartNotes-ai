// ---------------------------------------------------------------------------
// AI Notes Chat — RAG endpoint
// User asks a question → search notes by content/tags → LLM answers with citations
// Spec: SmartNotes_Structure.txt §4.4 + new idea ✨
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { openRouterComplete } from "@/shared/api/openrouter/openrouter-client";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";

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

type Note = {
  id: string;
  title: string;
  content: string;
  user_tags: string[];
  hidden_tags: string[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNote(note: Note, query: string): number {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const text = [
    note.title,
    stripHtml(note.content),
    ...note.user_tags,
    ...note.hidden_tags,
  ].join(" ").toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) score += 1;
    if (note.title.toLowerCase().includes(token)) score += 2; // title bonus
    if (note.user_tags.some((t) => t.includes(token))) score += 1.5;
  }
  return score;
}

export async function POST(request: Request) {
  // --- Auth ---
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

  // --- Fetch user notes ---
  const cookieStore = await cookies();
  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
  );

  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id, title, content, user_tags, hidden_tags")
    .eq("owner_id", userId)
    .is("trashed_at", null)
    .eq("is_archived", false)
    .limit(200);

  if (notesError || !notes) {
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500, headers: CORS_HEADERS });
  }

  // --- Score and pick top N relevant notes ---
  const scored = (notes as Note[])
    .map((note) => ({ note, score: scoreNote(note, question) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const citedNotes = scored.map(({ note }) => note);

  if (citedNotes.length === 0) {
    return NextResponse.json({
      answer: "По твоим заметкам я не нашёл информации по этому запросу. Попробуй сформулировать иначе.",
      citations: [],
    }, { headers: CORS_HEADERS });
  }

  // --- Build context for LLM ---
  const context = citedNotes.map((note, i) =>
    `[Note ${i + 1}: "${note.title || "Без названия"}"]\n${stripHtml(note.content).slice(0, 600)}`
  ).join("\n\n---\n\n");

  const userPrompt = `User's notes:\n\n${context}\n\n---\n\nQuestion: ${question}`;

  // --- LLM answer ---
  let answer: string;
  try {
    answer = await openRouterComplete(CHAT_SYSTEM_PROMPT, userPrompt, { response_format: { type: "text" }, max_tokens: 1024 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({
    answer,
    citations: citedNotes.map((note) => ({ id: note.id, title: note.title || "Без названия" })),
  }, { headers: CORS_HEADERS });
}
