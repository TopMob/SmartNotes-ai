import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { requireServerAuthorization } from "@/shared/api/supabase/auth-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireServerAuthorization();
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const payload = (await request.json()) as {
      rating: number;
      feedback: string;
      diagnostics: unknown[];
      systemLanguage: string;
      userAgent: string;
    };

    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );

    const { error } = await supabase
      .from("feedback")
      .insert({
        user_id: userId,
        rating: payload.rating,
        text: payload.feedback,
        technical_data: {
          diagnostics: payload.diagnostics,
          systemLanguage: payload.systemLanguage,
          userAgent: payload.userAgent,
        },
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
