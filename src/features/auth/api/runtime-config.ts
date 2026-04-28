import type { AuthRuntimeConfig } from "@/features/auth/model/types";

export async function fetchAuthRuntimeConfig(signal?: AbortSignal): Promise<AuthRuntimeConfig> {
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

  return (await response.json()) as AuthRuntimeConfig;
}
