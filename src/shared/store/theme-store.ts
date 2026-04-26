import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { enqueueSyncItem } from "@/services/sync/sync-queue";

export type ThemePreset = "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";

export type CustomThemePreset = {
  id: string;
  name: string;
  preset: ThemePreset;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  uiOpacity: number;
  cardsOpacity: number;
};

export type EditorToolKey =
  | "toolbarVisible"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bullets"
  | "numbered"
  | "hr"
  | "alignText"
  | "alignMedia"
  | "clearFormat"
  | "undoRedo"
  | "links"
  | "pages"
  | "inlineTags";

export type EditorSettings = Record<EditorToolKey, boolean>;

type ThemeSnapshot = {
  preset: ThemePreset;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  uiOpacity: number;
  cardsOpacity: number;
};

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
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

const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  preset: "paper",
  mainBackgroundUrl: null,
  sidebarBackgroundUrl: null,
  uiOpacity: 0.88,
  cardsOpacity: 0.92,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampOpacity(value: number) {
  return Number(clamp(value, 0.4, 1).toFixed(2));
}

function createPresetId() {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSafeStorage() {
  if (typeof window === "undefined") {
    return memoryStorage;
  }

  return window.localStorage;
}

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

type ThemeState = {
  preset: ThemePreset;
  lang: "ru" | "en";
  folderViewMode: "compact" | "full";
  notesPerPage: 5 | 10 | 20 | 50;
  reduceMotion: boolean;
  uiOpacity: number;
  cardsOpacity: number;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  customPresets: CustomThemePreset[];
  editor: EditorSettings;
  interface: {
    showSavedFilters: boolean;
    showTagFilter: boolean;
    showUpdatedPeriodFilter: boolean;
  };
  pendingSyncAt: string | null;
  setPreset: (preset: ThemePreset) => void;
  setLang: (lang: "ru" | "en") => void;
  toggleLang: () => void;
  setFolderViewMode: (mode: "compact" | "full") => void;
  setNotesPerPage: (value: 5 | 10 | 20 | 50) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setUiOpacity: (value: number) => void;
  setCardsOpacity: (value: number) => void;
  setMainBackgroundUrl: (value: string | null) => void;
  setSidebarBackgroundUrl: (value: string | null) => void;
  toggleInterfaceSection: (key: keyof ThemeState["interface"]) => void;
  toggleEditorTool: (key: EditorToolKey) => void;
  saveCurrentThemePreset: (name: string) => void;
  applyCustomPreset: (id: string) => void;
  removeCustomPreset: (id: string) => void;
  resetThemeCache: () => void;
  resetThemeSettings: () => void;
};

function enqueueThemeSync(payload: Partial<ThemeSnapshot> & Pick<ThemeSnapshot, "preset">) {
  enqueueSyncItem({
    id: "theme-settings",
    entity: "settings",
    operation: "patch",
    payload,
  });
}

function applyThemePatch(set: (partial: Partial<ThemeState> | ((state: ThemeState) => Partial<ThemeState>)) => void, patch: Partial<ThemeSnapshot>) {
  set((state) => ({
    ...patch,
    pendingSyncAt: new Date().toISOString(),
  }));
  enqueueThemeSync({
    preset: patch.preset ?? DEFAULT_THEME_SNAPSHOT.preset,
    mainBackgroundUrl: patch.mainBackgroundUrl ?? null,
    sidebarBackgroundUrl: patch.sidebarBackgroundUrl ?? null,
    uiOpacity: patch.uiOpacity ?? DEFAULT_THEME_SNAPSHOT.uiOpacity,
    cardsOpacity: patch.cardsOpacity ?? DEFAULT_THEME_SNAPSHOT.cardsOpacity,
  });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preset: DEFAULT_THEME_SNAPSHOT.preset,
      lang: "ru",
      folderViewMode: "full",
      notesPerPage: 10,
      reduceMotion: false,
      uiOpacity: DEFAULT_THEME_SNAPSHOT.uiOpacity,
      cardsOpacity: DEFAULT_THEME_SNAPSHOT.cardsOpacity,
      mainBackgroundUrl: DEFAULT_THEME_SNAPSHOT.mainBackgroundUrl,
      sidebarBackgroundUrl: DEFAULT_THEME_SNAPSHOT.sidebarBackgroundUrl,
      customPresets: [],
      editor: DEFAULT_EDITOR_SETTINGS,
      interface: {
        showSavedFilters: true,
        showTagFilter: true,
        showUpdatedPeriodFilter: true,
      },
      pendingSyncAt: null,
      setPreset: (preset) => applyThemePatch(set, { preset }),
      setLang: (lang) => set({ lang, pendingSyncAt: new Date().toISOString() }),
      toggleLang: () =>
        set((state) => ({
          lang: state.lang === "ru" ? "en" : "ru",
          pendingSyncAt: new Date().toISOString(),
        })),
      setFolderViewMode: (folderViewMode) => set({ folderViewMode, pendingSyncAt: new Date().toISOString() }),
      setNotesPerPage: (notesPerPage) => set({ notesPerPage, pendingSyncAt: new Date().toISOString() }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion, pendingSyncAt: new Date().toISOString() }),
      setUiOpacity: (uiOpacity) => applyThemePatch(set, { uiOpacity: clampOpacity(uiOpacity) }),
      setCardsOpacity: (cardsOpacity) => applyThemePatch(set, { cardsOpacity: clampOpacity(cardsOpacity) }),
      setMainBackgroundUrl: (mainBackgroundUrl) => applyThemePatch(set, { mainBackgroundUrl }),
      setSidebarBackgroundUrl: (sidebarBackgroundUrl) => applyThemePatch(set, { sidebarBackgroundUrl }),
      toggleInterfaceSection: (key) =>
        set((state) => ({
          interface: {
            ...state.interface,
            [key]: !state.interface[key],
          },
          pendingSyncAt: new Date().toISOString(),
        })),
      toggleEditorTool: (key) =>
        set((state) => ({
          editor: {
            ...state.editor,
            [key]: !state.editor[key],
          },
          pendingSyncAt: new Date().toISOString(),
        })),
      saveCurrentThemePreset: (name) => {
        const state = get();
        const nextPreset: CustomThemePreset = {
          id: createPresetId(),
          name: name.trim(),
          preset: state.preset,
          mainBackgroundUrl: state.mainBackgroundUrl,
          sidebarBackgroundUrl: state.sidebarBackgroundUrl,
          uiOpacity: state.uiOpacity,
          cardsOpacity: state.cardsOpacity,
        };

        if (!nextPreset.name) {
          return;
        }

        set((current) => ({
          customPresets: [...current.customPresets.filter((preset) => preset.name !== nextPreset.name).slice(-5), nextPreset],
          pendingSyncAt: new Date().toISOString(),
        }));
      },
      applyCustomPreset: (id) => {
        const preset = get().customPresets.find((item) => item.id === id);

        if (!preset) {
          return;
        }

        set({
          preset: preset.preset,
          mainBackgroundUrl: preset.mainBackgroundUrl,
          sidebarBackgroundUrl: preset.sidebarBackgroundUrl,
          uiOpacity: preset.uiOpacity,
          cardsOpacity: preset.cardsOpacity,
          pendingSyncAt: new Date().toISOString(),
        });
        enqueueThemeSync(preset);
      },
      removeCustomPreset: (id) =>
        set((state) => ({
          customPresets: state.customPresets.filter((preset) => preset.id !== id),
          pendingSyncAt: new Date().toISOString(),
        })),
      resetThemeCache: () => {
        useThemeStore.persist.clearStorage();
        set({
          ...DEFAULT_THEME_SNAPSHOT,
          lang: "ru",
          folderViewMode: "full",
          notesPerPage: 10,
          reduceMotion: false,
          customPresets: [],
          editor: DEFAULT_EDITOR_SETTINGS,
          interface: {
            showSavedFilters: true,
            showTagFilter: true,
            showUpdatedPeriodFilter: true,
          },
          pendingSyncAt: null,
        });
      },
      resetThemeSettings: () => {
        set({
          ...DEFAULT_THEME_SNAPSHOT,
          lang: "ru",
          folderViewMode: "full",
          notesPerPage: 10,
          reduceMotion: false,
          customPresets: [],
          editor: DEFAULT_EDITOR_SETTINGS,
          interface: {
            showSavedFilters: true,
            showTagFilter: true,
            showUpdatedPeriodFilter: true,
          },
          pendingSyncAt: new Date().toISOString(),
        });
        enqueueThemeSync(DEFAULT_THEME_SNAPSHOT);
      },
    }),
    {
      name: "smartnotes-theme-settings",
      version: 1,
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) => ({
        preset: state.preset,
        lang: state.lang,
        folderViewMode: state.folderViewMode,
        notesPerPage: state.notesPerPage,
        reduceMotion: state.reduceMotion,
        uiOpacity: state.uiOpacity,
        cardsOpacity: state.cardsOpacity,
        mainBackgroundUrl: state.mainBackgroundUrl,
        sidebarBackgroundUrl: state.sidebarBackgroundUrl,
        customPresets: state.customPresets,
        editor: state.editor,
        interface: state.interface,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<ThemeState>),
        uiOpacity: clampOpacity((persistedState as Partial<ThemeState>)?.uiOpacity ?? currentState.uiOpacity),
        cardsOpacity: clampOpacity((persistedState as Partial<ThemeState>)?.cardsOpacity ?? currentState.cardsOpacity),
        customPresets: ((persistedState as Partial<ThemeState>)?.customPresets ?? currentState.customPresets).slice(0, 6),
      }),
    },
  ),
);
