import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { AnalyzeNoteRequest } from "@/features/ai-engine/model/types";
import { analyzeNote } from "@/features/ai-engine/server/analyze-note";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import { getEmbedding } from "@/shared/lib/ai/local-embeddings";
import { stripHtml } from "@/shared/utils/string";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-secret",
};

const _ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",");

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function segmentText(text: string, chunkSize = 800, overlap = 150): string[] {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < cleanText.length) {
    let end = start + chunkSize;
    if (end < cleanText.length) {
      const lastSpace = cleanText.lastIndexOf(" ", end);
      if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }
    chunks.push(cleanText.slice(start, end).trim());
    start = end - overlap;
    if (start >= cleanText.length - 50) {
      break;
    }
  }
  return chunks.filter(Boolean);
}

export async function POST(request: Request) {

  const xSecret = request.headers.get("x-secret");
  const adminSecret = process.env.AI_ADMIN_SECRET;
  const isAdminCall = adminSecret && xSecret === adminSecret;

  let userId: string | null = null;

  if (!isAdminCall) {
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
  }

  let body: AnalyzeNoteRequest;
  try {
    body = (await request.json()) as AnalyzeNoteRequest;
    if (!body.noteId) throw new Error("noteId is required");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }


  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (serviceRoleKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(requireSupabaseUrl(), serviceRoleKey);
      
      // Update note status to analyzing in the database
      await admin.from("notes").update({ ai_status: "analyzing" }).eq("id", body.noteId);

      let ownerId = null;

      // 1. Fetch note details if title or content are missing
      if (!body.title || !body.content) {
        const { data: dbNote } = await admin
          .from("notes")
          .select("title, content, user_tags, owner_id")
          .eq("id", body.noteId)
          .single();

        if (dbNote) {
          ownerId = dbNote.owner_id;
          if (!body.title) body.title = dbNote.title || "";
          if (!body.content) body.content = dbNote.content || "";
          if (!body.userTags || body.userTags.length === 0) body.userTags = dbNote.user_tags || [];
        }
      }

      // 2. Fetch folderContext if missing
      if (!body.folderContext || body.folderContext.length === 0) {
        if (!ownerId) {
          const { data: noteData } = await admin
            .from("notes")
            .select("owner_id")
            .eq("id", body.noteId)
            .single();
          ownerId = noteData?.owner_id;
        }

        if (ownerId) {
          const { data: foldersData } = await admin
            .from("folders")
            .select("id, name, description")
            .eq("owner_id", ownerId)
            .eq("is_hidden", false)
            .is("trashed_at", null);

          body.folderContext = (foldersData || []).map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
          }));
        } else {
          body.folderContext = [];
        }
      }
    } catch (err) {
      console.error("Failed to populate missing details for AI analysis:", err);
    }
  }

  // Ensure default fallback values to prevent crashes in analyzeNote
  if (!body.title) body.title = "";
  if (!body.content) body.content = "";
  if (!body.userTags) body.userTags = [];
  if (!body.folderContext) body.folderContext = [];

  try {
    const result = await analyzeNote(body);


    if (serviceRoleKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(requireSupabaseUrl(), serviceRoleKey);

      // Get current metadata and owner info
      const { data: noteData } = await admin
        .from("notes")
        .select("owner_id, metadata")
        .eq("id", body.noteId)
        .single();
      
      const ownerId = noteData?.owner_id;
      const currentMetadata = noteData?.metadata || {};
      const newMetadata = {
        ...currentMetadata,
        summary: result.summary || currentMetadata.summary || null,
      };

      await admin.from("notes").update({
        user_tags: result.userTags,
        hidden_tags: result.hiddenTags,
        folder_id: result.folderId ?? undefined,
        ai_relevance: result.relevance,
        resurfacing_class: result.resurfacingClass,
        ai_status: "done",
        ai_processed: true,
        analyzed: true,
        ai_error: null,
        prompt_version: result.promptVersion,
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      }).eq("id", body.noteId);

      // Generate vector embeddings locally and save to note_embeddings
      const plainText = stripHtml(body.content || "");
      if (plainText && ownerId) {
        const chunks = segmentText(plainText);
        const records = [];
        
        // Clear old embeddings first
        await admin.from("note_embeddings").delete().eq("note_id", body.noteId);

        for (let i = 0; i < chunks.length; i++) {
          try {
            const vector = await getEmbedding(chunks[i]);
            records.push({
              note_id: body.noteId,
              owner_id: ownerId,
              chunk_index: i,
              content: chunks[i],
              embedding: vector,
            });
          } catch (err) {
            console.error(`Failed to generate embedding for chunk ${i}:`, err);
          }
        }
        
        if (records.length > 0) {
          await admin.from("note_embeddings").insert(records);
        }
      }
    }

    return NextResponse.json({ status: "done", result }, { headers: CORS_HEADERS });
  } catch (error) {

    if (serviceRoleKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(requireSupabaseUrl(), serviceRoleKey);
        const message = error instanceof Error ? error.message : "AI analysis failed";
        await admin.from("notes").update({ ai_status: "error", ai_error: message }).eq("id", body.noteId);
      } catch {

      }
    }

    const message = error instanceof Error ? error.message : "AI analysis failed";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
