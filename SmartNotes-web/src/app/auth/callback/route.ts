import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as any;
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";

  const errorName = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorName || errorDescription) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("error", errorDescription || errorName || "oauth_error");
    return NextResponse.redirect(destination);
  }

  if (!code && !tokenHash) {
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

  let data = null;
  let error = null;

  if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    data = res.data;
    error = res.error;
  } else if (tokenHash && type) {
    const res = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type,
    });
    data = res.data;
    error = res.error;
  }

  if (error) {
    console.error("[auth/callback] authentication failed:", error.message);
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
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (data?.session?.user) {
    const providerToken = data.session.provider_token;
    const providerRefreshToken = data.session.provider_refresh_token;

    if (providerToken || providerRefreshToken) {
      try {
        const { data: existing } = await supabase
          .from("user_google_integrations")
          .select("refresh_token")
          .eq("user_id", data.session.user.id)
          .maybeSingle();

        const finalRefreshToken = providerRefreshToken || existing?.refresh_token;

        if (finalRefreshToken) {
          const { error: upsertError } = await supabase
            .from("user_google_integrations")
            .upsert(
              {
                user_id: data.session.user.id,
                provider: "google",
                access_token: providerToken ?? null,
                refresh_token: finalRefreshToken,
                scope: data.session.user?.app_metadata?.provider ?? null,
                last_refreshed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );

          if (upsertError) {
            console.error("[auth/callback] Failed to upsert user_google_integrations:", upsertError.message);
          }
        }
      } catch (dbErr) {
        console.error("[auth/callback] Database error during token upsert:", dbErr);
      }
    }
  }

  return response;
}
