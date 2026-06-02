import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Note } from "@/entities/note";
import { requireSupabasePublishableKey, requireSupabaseUrl } from "@/shared/api/supabase/env";
import { getEmbedding } from "@/shared/lib/ai/local-embeddings";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type SemanticMatch = {
  note_id: string;
  note_title?: string;
  content: string;
  similarity?: number;
};

function extractCandidateChunks(notes: Note[]) {
  const chunks: Array<{ note_id: string; note_title: string; content: string }> = [];

  for (const note of notes) {
    if (note.lock) {
      continue;
    }

    if (note.pages?.length) {
      for (const page of note.pages) {
        const plainText = page.content?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (plainText) {
          chunks.push({
            note_id: note.id,
            note_title: note.title || "Без названия",
            content: plainText,
          });
        }
      }
      continue;
    }

    const plainText = note.content?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (plainText) {
      chunks.push({
        note_id: note.id,
        note_title: note.title || "Без названия",
        content: plainText,
      });
    }
  }

  return chunks.slice(0, 48);
}

function cosineSimilarity(left: number[], right: number[]) {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  const leftNorm = Math.sqrt(leftMagnitude);
  const rightNorm = Math.sqrt(rightMagnitude);

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dotProduct / (leftNorm * rightNorm);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let query = "";
  let candidateNoteIds: string[] = [];
  let clientNotes: Note[] | undefined;

  try {
    const body = await request.json();
    query = body.query;
    candidateNoteIds = Array.isArray(body.candidateNoteIds) ? body.candidateNoteIds : [];
    clientNotes = Array.isArray(body.notes) ? body.notes : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
  }

  if (!query.trim()) {
    return NextResponse.json({ matches: [] }, { headers: CORS_HEADERS });
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

  try {
    const queryEmbedding = await getEmbedding(query);

    if (userId) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        requireSupabaseUrl(),
        requireSupabasePublishableKey(),
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
      );

      const { data, error } = await supabase.rpc("match_note_embeddings", {
        query_embedding: queryEmbedding,
        match_threshold: 0.15,
        match_count: 8,
        p_owner_id: userId,
      });

      if (error) {
        throw error;
      }

      const allowedIds = new Set(candidateNoteIds);
      const uniqueMatches = new Map<string, number>();

      for (const match of (data as SemanticMatch[]) ?? []) {
        if (allowedIds.size > 0 && !allowedIds.has(match.note_id)) {
          continue;
        }

        const currentScore = uniqueMatches.get(match.note_id) ?? -1;
        const nextScore = match.similarity ?? 0;
        if (nextScore > currentScore) {
          uniqueMatches.set(match.note_id, nextScore);
        }
      }

      return NextResponse.json(
        {
          matches: Array.from(uniqueMatches.entries()).map(([noteId, similarity]) => ({ noteId, similarity })),
        },
        { headers: CORS_HEADERS },
      );
    }

    if (!clientNotes) {
      return NextResponse.json({ matches: [] }, { headers: CORS_HEADERS });
    }

    const chunks = extractCandidateChunks(clientNotes.filter((note) => candidateNoteIds.length === 0 || candidateNoteIds.includes(note.id)));
    const chunkEmbeddings = await Promise.all(
      chunks.map(async (chunk) => ({
        chunk,
        embedding: await getEmbedding(chunk.content),
      })),
    );

    const bestMatches = new Map<string, number>();

    for (const { chunk, embedding } of chunkEmbeddings) {
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      if (similarity < 0.18) {
        continue;
      }

      const currentScore = bestMatches.get(chunk.note_id) ?? -1;
      if (similarity > currentScore) {
        bestMatches.set(chunk.note_id, similarity);
      }
    }

    return NextResponse.json(
      {
        matches: Array.from(bestMatches.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, 8)
          .map(([noteId, similarity]) => ({ noteId, similarity })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("Semantic search failed:", error);
    return NextResponse.json({ matches: [] }, { headers: CORS_HEADERS });
  }
}
