import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseUrl, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import { requireAdminAuthorization } from "@/shared/api/supabase/auth-guard";

export const runtime = "nodejs";

export async function GET() {
  try {
    try {
      await requireAdminAuthorization();
    } catch (authError) {
      const forbidden = authError instanceof Error && authError.message === "Forbidden";
      return NextResponse.json(
        { error: forbidden ? "Forbidden" : "Unauthorized" },
        { status: forbidden ? 403 : 401 },
      );
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
