import type { UserSettings } from "@/entities/settings";
import { DEFAULT_USER_SETTINGS } from "@/features/settings/lib/settings-defaults";
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from "@/shared/lib/local-storage";

const LOCAL_SETTINGS_PREFIX = "smartnotes:local:settings:";

function buildSettings(userId: string): UserSettings {
  const now = new Date().toISOString();
  return {
    id: userId,
    ...DEFAULT_USER_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };
}

export const localSettingsRepository = {
  async get(userId: string) {
    const key = `${LOCAL_SETTINGS_PREFIX}${userId}`;
    const value = readJsonFromLocalStorage<UserSettings | null>(key, null);

    if (value) {
      return value;
    }

    const initial = buildSettings(userId);
    writeJsonToLocalStorage(key, initial);
    return initial;
  },
  async patch(userId: string, patch: Partial<UserSettings>) {
    const key = `${LOCAL_SETTINGS_PREFIX}${userId}`;
    const current = await this.get(userId);
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    writeJsonToLocalStorage(key, next);
    return next;
  },
};
