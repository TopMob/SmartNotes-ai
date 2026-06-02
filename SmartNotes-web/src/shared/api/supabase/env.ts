import { assertDefined } from "@/shared/lib/utils";

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => value && value.length > 0);
}

export function getSupabaseUrl() {
  return firstDefined(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL);
}

export function getSupabasePublishableKey() {
  return firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseServiceRoleKey() {
  return firstDefined(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SMARTNOTES_SUPABASE_SERVICE_ROLE_KEY);
}

export function requireSupabaseUrl() {
  return assertDefined(getSupabaseUrl(), "Supabase URL env is required");
}

export function requireSupabasePublishableKey() {
  return assertDefined(getSupabasePublishableKey(), "Supabase publishable key env is required");
}

