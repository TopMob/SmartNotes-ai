import type { User as SupabaseUser } from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "@/shared/api/supabase/types";

export async function bootstrapProfile(supabase: TypedSupabaseClient, user: SupabaseUser) {
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
}
