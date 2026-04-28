import type { UserSettings, UserSettingsPatch } from "@/entities/settings";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { mapSettingsInsert, mapSettingsPatchToUpdate, mapSettingsRow } from "./settings-mappers";

export type SettingsRepository = {
  get: (userId: string) => Promise<UserSettings>;
  patch: (userId: string, patch: UserSettingsPatch) => Promise<UserSettings>;
};

export const settingsRepository: SettingsRepository = {
  async get(userId) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("user_settings").select("*").eq("id", userId).maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return mapSettingsRow(data);
    }

    const { data: inserted, error: insertError } = await supabase.from("user_settings").insert(mapSettingsInsert(userId)).select("*").single();

    if (insertError) {
      throw insertError;
    }

    return mapSettingsRow(inserted);
  },
  async patch(userId, patch) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("user_settings")
      .update(mapSettingsPatchToUpdate(patch))
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapSettingsRow(data);
  },
};
