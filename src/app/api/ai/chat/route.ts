import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { openRouterComplete } from "@/shared/api/openrouter/openrouter-client";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { getEmbedding } from "@/shared/lib/ai/local-embeddings";
import type { Note } from "@/entities/note";

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
  let question: string;
  let clientNotes: Note[] | undefined;

  try {
    const body = await request.json();
    question = body.question;
    clientNotes = body.notes;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
  }

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400, headers: CORS_HEADERS });
  }

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

  if (!userId && (!clientNotes || !Array.isArray(clientNotes))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let chunks: EmbeddingMatch[] = [];

  if (clientNotes && Array.isArray(clientNotes)) {
    try {
      const questionEmbedding = await getEmbedding(question);
      const allChunks: { note_id: string; note_title: string; content: string }[] = [];

      for (const note of clientNotes) {
        if (note.lock) continue; // Skip locked notes

        if (note.pages && note.pages.length > 0) {
          for (const page of note.pages) {
            if (page.content?.trim()) {
              allChunks.push({
                note_id: note.id,
                note_title: note.title || "Без названия",
                content: page.content.replace(/<[^>]*>/g, " ").trim(),
              });
            }
          }
        } else if (note.content?.trim()) {
          allChunks.push({
            note_id: note.id,
            note_title: note.title || "Без названия",
            content: note.content.replace(/<[^>]*>/g, " ").trim(),
          });
        }
      }

      if (allChunks.length > 0) {
        const chunkEmbeddings = await Promise.all(
          allChunks.map(async (c) => {
            try {
              const emb = await getEmbedding(c.content);
              return { chunk: c, embedding: emb };
            } catch (e) {
              console.error("Failed to embed chunk:", e);
              return { chunk: c, embedding: null };
            }
          })
        );

        const cosineSimilarity = (a: number[], b: number[]) => {
          let dotProduct = 0;
          let mA = 0;
          let mB = 0;
          for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
          }
          mA = Math.sqrt(mA);
          mB = Math.sqrt(mB);
          if (mA === 0 || mB === 0) return 0;
          return dotProduct / (mA * mB);
        };

        const matches = chunkEmbeddings
          .filter((ce) => ce.embedding !== null)
          .map((ce) => {
            const similarity = cosineSimilarity(questionEmbedding, ce.embedding!);
            return {
              ...ce.chunk,
              similarity,
            };
          })
          .filter((m) => m.similarity >= 0.15)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 6);

        chunks = matches;
      }
    } catch (error) {
      console.error("Local vector matching failed:", error);
      return NextResponse.json({ error: "Failed to search local vector embeddings" }, { status: 500, headers: CORS_HEADERS });
    }
  } else {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        requireSupabaseUrl(),
        requireSupabasePublishableKey(),
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
      );
      const questionEmbedding = await getEmbedding(question);
      const { data, error } = await supabase.rpc("match_note_embeddings", {
        query_embedding: questionEmbedding,
        match_threshold: 0.15,
        match_count: 6,
        p_owner_id: userId,
      });

      if (error) throw error;
      chunks = (data as EmbeddingMatch[]) || [];
    } catch (error) {
      console.error("Vector matching failed:", error);
      return NextResponse.json({ error: "Failed to search vector embeddings" }, { status: 500, headers: CORS_HEADERS });
    }
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
