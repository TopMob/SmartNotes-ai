import type { AuthRuntimeConfig } from "@/features/auth/model/types";

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Read runtime config straight from `NEXT_PUBLIC_*` env vars inlined into the client bundle.
 * This skips the `/api/supabase/config` round-trip during login boot. Falls back to the
 * API route only if no public env vars are present (e.g. legacy preview deploys).
 */
export async function fetchAuthRuntimeConfig(signal?: AbortSignal): Promise<AuthRuntimeConfig> {
  const inline: AuthRuntimeConfig = {
    url: firstNonEmpty(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL,
    ),
    publishableKey: firstNonEmpty(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY,
    ),
    googleClientId: firstNonEmpty(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_SMARTNOTES_GOOGLE_CLIENT_ID,
    ),
  };

  if (inline.url && inline.publishableKey) {
    return inline;
  }


  const response = await fetch("/api/supabase/config", {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load auth runtime config: ${response.status}`);
  }

  const remote = (await response.json()) as AuthRuntimeConfig;
  return {
    url: inline.url ?? remote.url,
    publishableKey: inline.publishableKey ?? remote.publishableKey,
    googleClientId: inline.googleClientId ?? remote.googleClientId,
  };
}
