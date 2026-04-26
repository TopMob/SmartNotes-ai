import { createBrowserClient } from "@supabase/ssr";

import { assertDefined } from "@/shared/lib/utils";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    assertDefined(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL is required"),
    assertDefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  );
}
