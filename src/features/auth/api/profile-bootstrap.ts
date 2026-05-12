import type { User as SupabaseUser } from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "@/shared/api/supabase/types";

const BOOTSTRAPPED_FLAG_PREFIX = "sn_profile_bootstrapped_";

function bootstrappedFlagKey(userId: string) {
  return `${BOOTSTRAPPED_FLAG_PREFIX}${userId}`;
}

function hasBootstrappedFlag(userId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(bootstrappedFlagKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markBootstrapped(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(bootstrappedFlagKey(userId), "1");
  } catch {

  }
}

/**
 * Upsert the user's profile row. Skipped on subsequent visits via a localStorage flag
 * so that returning users avoid the round-trip on every login.
 */
export async function bootstrapProfile(supabase: TypedSupabaseClient, user: SupabaseUser) {
  if (hasBootstrappedFlag(user.id)) {
    return;
  }

  const payload = {
    id: user.id,
    email: user.email ?? null,
    display_name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    throw error;
  }

  markBootstrapped(user.id);
}
