import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublishableKey, requireSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(requireSupabaseUrl(), requireSupabasePublishableKey());
}
