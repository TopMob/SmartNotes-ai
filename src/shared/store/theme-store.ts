import { create } from "zustand";

type ThemeState = {
  preset: string;
  reduceMotion: boolean;
  uiOpacity: number;
  cardsOpacity: number;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  setPreset: (preset: string) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  preset: "warm_default",
  reduceMotion: false,
  uiOpacity: 0.88,
  cardsOpacity: 0.92,
  mainBackgroundUrl: null,
  sidebarBackgroundUrl: null,
  setPreset: (preset) => set({ preset }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
}));
