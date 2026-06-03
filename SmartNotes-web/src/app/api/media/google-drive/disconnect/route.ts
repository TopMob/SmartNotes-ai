import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("sb-provider-token");
    cookieStore.delete("sb-provider-refresh-token");

    const supabase = createServerClient<Database>(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              for (const cookie of cookiesToSet) {
                cookieStore.set(cookie.name, cookie.value, cookie.options);
              }
            } catch {}
          }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from("user_google_integrations")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to delete user google integration row:", error.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect Google Drive" },
      { status: 500 }
    );
  }
}
