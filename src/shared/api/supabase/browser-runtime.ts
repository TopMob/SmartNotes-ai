import { getSupabasePublishableKey, getSupabaseUrl } from "@/shared/api/supabase/env";

export function hasSupabaseBrowserConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
