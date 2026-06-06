import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import { requireServerAuthorization } from "@/shared/api/supabase/auth-guard";

export const runtime = "nodejs";

export async function GET() {
  try {
    let session;
    try {
      session = await requireServerAuthorization();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!serviceRoleKey) {
       return NextResponse.json({ error: "Missing service role key" }, { status: 500 });
    }

    const supabaseAdmin = createServerClient(
      requireSupabaseUrl(),
      serviceRoleKey,
      { cookies: { getAll: () => [], setAll: () => undefined } }
    );

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
