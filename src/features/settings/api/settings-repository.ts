import type { UserSettings, UserSettingsPatch } from "@/entities/settings";
import { isGuestUser } from "@/features/auth/lib/guest-session";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { localSettingsRepository } from "@/features/settings/api/local-settings-repository";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { mapSettingsInsert, mapSettingsPatchToUpdate, mapSettingsRow } from "./settings-mappers";

function shouldUseLocal(): boolean {
  const user = useAuthStore.getState().user;
  return !user || isGuestUser(user);
}

export type SettingsRepository = {
  get: (userId: string) => Promise<UserSettings>;
  patch: (userId: string, patch: UserSettingsPatch) => Promise<UserSettings>;
};

export const settingsRepository: SettingsRepository = {
  async get(userId) {
    if (shouldUseLocal()) {
      return localSettingsRepository.get(userId);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localSettingsRepository.get(userId);
    }

    const { data, error } = await supabase.from("user_settings").select("*").eq("id", userId).maybeSingle();

    if (error) {
      return localSettingsRepository.get(userId);
    }

    if (data) {
      return mapSettingsRow(data);
    }

    const { data: inserted, error: insertError } = await supabase.from("user_settings").insert(mapSettingsInsert(userId)).select("*").single();

    if (insertError) {
      return localSettingsRepository.get(userId);
    }

    return mapSettingsRow(inserted);
  },
  async patch(userId, patch) {
    if (shouldUseLocal()) {
      return localSettingsRepository.patch(userId, patch);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localSettingsRepository.patch(userId, patch);
    }

    const { data, error } = await supabase
      .from("user_settings")
      .update(mapSettingsPatchToUpdate(patch))
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      return localSettingsRepository.patch(userId, patch);
    }

    return mapSettingsRow(data);
  },
};
