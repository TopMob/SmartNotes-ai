import { create } from "zustand";

export type SortField = "updatedAt" | "relevance" | "importance" | "alphabetical" | "textLength" | "manual";

export type FilterPreset = {
  id: string;
  name: string;
  query: string;
  folders: string[];
  tags: string[];
  updatedWindowDays: number | null;
  sort: SortField;
};

type SearchState = {
  query: string;
  folders: string[];
  tags: string[];
  updatedWindowDays: number | null;
  sort: SortField;
  savedPresets: FilterPreset[];
  showSavedFilters: boolean;
  showTagFilter: boolean;
  showUpdatedPeriodFilter: boolean;
  setQuery: (query: string) => void;
  setFolders: (folders: string[]) => void;
  setTags: (tags: string[]) => void;
  setUpdatedWindowDays: (days: number | null) => void;
  setSort: (sort: SortField) => void;
  savePreset: (preset: Omit<FilterPreset, "id">) => void;
  removePreset: (id: string) => void;
  applyPreset: (preset: FilterPreset) => void;
  toggleVisibility: (key: "showSavedFilters" | "showTagFilter" | "showUpdatedPeriodFilter") => void;
  resetFilters: () => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  folders: [],
  tags: [],
  updatedWindowDays: null,
  sort: "updatedAt",
  savedPresets: [],
  showSavedFilters: true,
  showTagFilter: true,
  showUpdatedPeriodFilter: true,
  setQuery: (query) => set({ query }),
  setFolders: (folders) => set({ folders }),
  setTags: (tags) => set({ tags }),
  setUpdatedWindowDays: (updatedWindowDays) => set({ updatedWindowDays }),
  setSort: (sort) => set({ sort }),
  savePreset: (presetData) => set((state) => ({
    savedPresets: [...state.savedPresets, { ...presetData, id: Math.random().toString(36).slice(2) }]
  })),
  removePreset: (id) => set((state) => ({
    savedPresets: state.savedPresets.filter(p => p.id !== id)
  })),
  applyPreset: (preset) => set({
    query: preset.query,
    folders: preset.folders,
    tags: preset.tags,
    updatedWindowDays: preset.updatedWindowDays,
    sort: preset.sort
  }),
  toggleVisibility: (key) => set((state) => ({ [key]: !state[key] })),
  resetFilters: () => set({
    query: "",
    folders: [],
    tags: [],
    updatedWindowDays: null,
    sort: "updatedAt"
  }),
}));
