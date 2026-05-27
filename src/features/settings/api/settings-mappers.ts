import type { UserSettings, UserSettingsPatch } from "@/entities/settings";
import type { Database } from "@/shared/api/supabase/types";
import { DEFAULT_USER_SETTINGS, normalizeSettings } from "@/features/settings/lib/settings-defaults";

type SettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
type SettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];
type SettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"];

export function mapSettingsRow(row: SettingsRow): UserSettings {
  return normalizeSettings({
    id: row.id,
    preset: row.preset,
    lang: row.lang,
    folderViewMode: row.folder_view_mode,
    notesPerPage: row.notes_per_page as any,
    reduceMotion: row.reduce_motion,
    uiOpacity: row.ui_opacity,
    cardsOpacity: row.cards_opacity,
    mainBackgroundUrl: row.main_background_url,
    sidebarBackgroundUrl: row.sidebar_background_url,
    customPresets: row.custom_presets as any,
    editor: row.editor as any,
    interface: row.interface as any,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapSettingsInsert(userId: string): SettingsInsert {
  return {
    id: userId,
    preset: DEFAULT_USER_SETTINGS.preset,
    lang: DEFAULT_USER_SETTINGS.lang,
    folder_view_mode: DEFAULT_USER_SETTINGS.folderViewMode,
    notes_per_page: DEFAULT_USER_SETTINGS.notesPerPage,
    reduce_motion: DEFAULT_USER_SETTINGS.reduceMotion,
    ui_opacity: DEFAULT_USER_SETTINGS.uiOpacity,
    cards_opacity: DEFAULT_USER_SETTINGS.cardsOpacity,
    main_background_url: DEFAULT_USER_SETTINGS.mainBackgroundUrl,
    sidebar_background_url: DEFAULT_USER_SETTINGS.sidebarBackgroundUrl,
    custom_presets: DEFAULT_USER_SETTINGS.customPresets,
    editor: DEFAULT_USER_SETTINGS.editor,
    interface: DEFAULT_USER_SETTINGS.interface,
  };
}

export function mapSettingsPatchToUpdate(patch: UserSettingsPatch): SettingsUpdate {
  return {
    ...(patch.preset === undefined ? null : { preset: patch.preset }),
    ...(patch.lang === undefined ? null : { lang: patch.lang }),
    ...(patch.folderViewMode === undefined ? null : { folder_view_mode: patch.folderViewMode }),
    ...(patch.notesPerPage === undefined ? null : { notes_per_page: patch.notesPerPage }),
    ...(patch.reduceMotion === undefined ? null : { reduce_motion: patch.reduceMotion }),
    ...(patch.uiOpacity === undefined ? null : { ui_opacity: patch.uiOpacity }),
    ...(patch.cardsOpacity === undefined ? null : { cards_opacity: patch.cardsOpacity }),
    ...(patch.mainBackgroundUrl === undefined ? null : { main_background_url: patch.mainBackgroundUrl }),
    ...(patch.sidebarBackgroundUrl === undefined ? null : { sidebar_background_url: patch.sidebarBackgroundUrl }),
    ...(patch.customPresets === undefined ? null : { custom_presets: patch.customPresets }),
    ...(patch.editor === undefined ? null : { editor: patch.editor }),
    ...(patch.interface === undefined ? null : { interface: patch.interface }),
    updated_at: new Date().toISOString(),
  };
}
