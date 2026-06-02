import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";
import SettingsClient from "./SettingsClient";

export const runtime = "nodejs";

export default async function SettingsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {}
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  let isDriveConnected = false;

  if (user) {
    const { data: integration } = await supabase
      .from("user_google_integrations")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    isDriveConnected = !!integration;
  }

  return <SettingsClient initialDriveConnected={isDriveConnected} />;
}
