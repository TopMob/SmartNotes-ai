import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return NextResponse.redirect(new URL("/login?error=missing_config", request.url));
  }



  const isHttps = request.nextUrl.protocol === "https:";
  const response = NextResponse.redirect(new URL(safeNext, request.url));

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, {
            ...cookie.options,
            secure: isHttps,
          });
        }
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  if (data?.session?.provider_token) {
    response.cookies.set("sb-provider-token", data.session.provider_token, {
      path: "/",
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: data.session.expires_in ?? 3500,
    });
  }

  if (data?.session?.provider_refresh_token) {
    response.cookies.set("sb-provider-refresh-token", data.session.provider_refresh_token, {
      path: "/",
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return response;
}
