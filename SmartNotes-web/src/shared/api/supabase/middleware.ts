import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export function updateSupabaseSession(request: NextRequest, response: NextResponse) {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return null;
  }

  const isHttps = request.nextUrl.protocol === "https:";

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

  return supabase.auth.getUser();
}

/**
 * Auth-aware routing:
 *  - Unauthenticated users accessing protected routes → /login
 *  - Authenticated users accessing /login → /
 *  - Auth callback, static assets, etc. are always allowed
 */
const _PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);


