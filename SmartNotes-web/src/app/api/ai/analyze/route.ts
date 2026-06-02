import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

import type { AnalyzeNoteRequest } from "@/features/ai-engine/model/types";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import { normalizeText } from "@/shared/utils/string";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-secret",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function computeHashNode(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
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
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(requireSupabaseUrl(), serviceRoleKey);
    
    // 1. Fetch note details if title or content are missing
    if (!body.title || !body.content) {
      const { data: dbNote } = await admin
        .from("notes")
        .select("title, content, owner_id")
        .eq("id", body.noteId)
        .single();

      if (dbNote) {
        if (!body.title) body.title = dbNote.title || "";
        if (!body.content) body.content = dbNote.content || "";
      }
    }

    // 2. Compute current note hash (combining title + content to detect any edits)
    const combinedText = `${body.title || ""} ${body.content || ""}`;
    const normalized = normalizeText(combinedText);
    const contentHash = computeHashNode(normalized);

    // 3. Fetch existing metadata to check for matching hash
    const { data: noteData } = await admin
      .from("notes")
      .select("metadata, ai_status")
      .eq("id", body.noteId)
      .single();

    const existingMetadata = noteData?.metadata || {};
    const storedHash = (existingMetadata as Record<string, unknown>).content_hash || null;

    if (contentHash === storedHash) {
      console.log("Content hash matches. Skipping AI analyze trigger.");
      await admin.from("notes").update({ ai_status: "done", analyzed: true }).eq("id", body.noteId);
      return NextResponse.json({ status: "done", skipped: true }, { headers: CORS_HEADERS });
    }

    await admin.from("notes").update({ ai_status: "pending" }).eq("id", body.noteId);

    const supabaseUrl = requireSupabaseUrl();
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        noteId: body.noteId,
        contentHash: contentHash,
        openRouterKey: process.env.OPENROUTER_API_KEY || null,
        openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || null,
        openRouterModel: process.env.OPENROUTER_MODEL || null,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Edge function invocation failed: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    return NextResponse.json({ status: "queued", result: resJson }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("AI analysis route error:", error);
    
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(requireSupabaseUrl(), serviceRoleKey);
      await admin
        .from("notes")
        .update({
          ai_status: "error",
          ai_error: error instanceof Error ? error.message : String(error)
        })
        .eq("id", body.noteId);
    } catch (dbErr) {
      console.error("Failed to update note status to error:", dbErr);
    }
      
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start AI analysis" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
