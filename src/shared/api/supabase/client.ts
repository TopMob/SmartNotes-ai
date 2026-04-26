import { createBrowserClient } from "@supabase/ssr";

import { assertDefined } from "@/shared/lib/utils";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL;
}

function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY;
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    assertDefined(getSupabaseUrl(), "Supabase URL env is required"),
    assertDefined(getSupabasePublishableKey(), "Supabase publishable key env is required"),
  );
}
