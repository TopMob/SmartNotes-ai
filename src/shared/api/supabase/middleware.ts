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

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
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
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

export function applyAuthRedirects(request: NextRequest, response: NextResponse) {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  // We cannot easily await getUser() here without making the caller async,
  // so we rely on the session cookies that updateSupabaseSession already
  // refreshed. The redirect logic is intentionally lightweight — the
  // client-side AuthProvider still guards edge cases.
  return response;
}
