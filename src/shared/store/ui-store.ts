import { create } from "zustand";

export type AppView = "notes" | "favorites" | "archive" | "folder" | "folders" | "reminders" | "locked" | "trash" | "hidden_folders" | "admin_tools";

type UiState = {
  view: AppView;
  activeFolderId: string | null;
  searchQuery: string;
  sidebarOpen: boolean;
  setView: (view: AppView) => void;
  setActiveFolderId: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "notes",
  activeFolderId: null,
  searchQuery: "",
  sidebarOpen: false,
  setView: (view) => set({ view }),
  setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
