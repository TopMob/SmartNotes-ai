import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { AnalyzeNoteRequest } from "@/features/ai-engine/model/types";
import { analyzeNote } from "@/features/ai-engine/server/analyze-note";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";

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
      await admin.from("notes").update({ ai_status: "analyzing" }).eq("id", body.noteId);
    } catch {

    }
  }


  try {
    const result = await analyzeNote(body);


    if (serviceRoleKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(requireSupabaseUrl(), serviceRoleKey);
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
        updated_at: new Date().toISOString(),
      }).eq("id", body.noteId);
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
