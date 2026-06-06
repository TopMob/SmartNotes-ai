import type { EditorSettings, UserSettings } from "@/entities/settings";

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  toolbarVisible: true,
  bold: true,
  italic: true,
  underline: true,
  strike: true,
  bullets: true,
  numbered: true,
  hr: true,
  alignText: true,
  alignMedia: true,
  clearFormat: true,
  undoRedo: true,
  links: true,
  pages: true,
  inlineTags: true,
};

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "id" | "createdAt" | "updatedAt"> = {
  preset: "classic",
  lang: "ru",
  folderViewMode: "full",
  notesPerPage: 30,
  reduceMotion: false,
  uiOpacity: 0.88,
  cardsOpacity: 0.92,
  mainBackgroundUrl: null,
  sidebarBackgroundUrl: null,
  customPresets: [],
  editor: DEFAULT_EDITOR_SETTINGS,
  interface: {
    showSavedFilters: true,
    showTagFilter: true,
    showUpdatedPeriodFilter: true,
  },
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampOpacity(value: number) {
  return Number(clamp(value, 0.4, 1).toFixed(2));
}

export function normalizeNotesPerPage(value: number) {
  return Math.min(1000, Math.max(1, typeof value === "number" ? value : 30));
}

export function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    notesPerPage: normalizeNotesPerPage(settings.notesPerPage),
    uiOpacity: clampOpacity(settings.uiOpacity),
    cardsOpacity: clampOpacity(settings.cardsOpacity),
    customPresets: Array.isArray(settings.customPresets) ? settings.customPresets.slice(0, 6) : [],
    editor: {
      ...DEFAULT_EDITOR_SETTINGS,
      ...settings.editor,
    },
    interface: {
      ...DEFAULT_USER_SETTINGS.interface,
      ...settings.interface,
    },
  };
}
