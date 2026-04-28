import { createClient } from "@supabase/supabase-js";

import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
