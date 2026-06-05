import type { User as SupabaseUser } from "@supabase/supabase-js";

import type { User } from "@/entities/user";

export function mapAuthUser(user: SupabaseUser): User {
  const displayName = typeof user.user_metadata?.name === "string"
    ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const photoURL = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
  const hasGoogleLinked = user.identities?.some((id) => id.provider === "google") || (user.app_metadata?.providers as string[])?.includes("google") || false;
  const hasPassword = user.identities?.some((id) => id.provider === "email") || (user.app_metadata?.providers as string[])?.includes("email") || false;

  return {
    id: user.id,
    uid: user.id,
    email: user.email ?? null,
    displayName,
    photoURL,
    hasGoogleLinked,
    hasPassword,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
  };
}
