import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { requireSupabasePublishableKey, requireSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export function updateSupabaseSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(requireSupabaseUrl(), requireSupabasePublishableKey(), {
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
