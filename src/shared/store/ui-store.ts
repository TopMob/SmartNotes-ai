import { create } from "zustand";

import { DEFAULT_NOTES_FILTER, type NotesFilter, type NotesSort } from "@/features/notes/model/note-selectors";

export type AppView = "notes" | "favorites" | "archive" | "folder" | "folders" | "reminders" | "locked" | "trash" | "hidden_folders" | "admin_tools";

type UiState = {
  view: AppView;
  activeFolderId: string | null;
  searchQuery: string;
  notesFilter: NotesFilter;
  savedFilters: Array<{ id: string; name: string; filter: NotesFilter }>;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  desktopSidebarPinned: boolean;
  aiChatOpen: boolean;
  setView: (view: AppView) => void;
  setActiveFolderId: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setNotesSort: (sort: NotesSort) => void;
  toggleFolderFilter: (folderId: string | null) => void;
  toggleTagFilter: (tag: string) => void;
  setUpdatedWindowDays: (days: number | null) => void;
  resetNotesFilter: () => void;
  saveCurrentFilter: (name: string) => void;
  applySavedFilter: (id: string) => void;
  deleteSavedFilter: (id: string) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
  toggleDesktopSidebarPinned: () => void;
  setAiChatOpen: (open: boolean) => void;
  toggleAiChat: () => void;
  developerMode: boolean;
  setDeveloperMode: (dev: boolean) => void;
  toggleDeveloperMode: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "notes",
  activeFolderId: null,
  searchQuery: "",
  notesFilter: DEFAULT_NOTES_FILTER,
  savedFilters: [],
  mobileSidebarOpen: false,
  desktopSidebarOpen: false,
  desktopSidebarPinned: false,
  aiChatOpen: false,
  developerMode: false,
  setView: (view) => set({ view }),
  setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setNotesSort: (sort) => set((state) => ({ notesFilter: { ...state.notesFilter, sort } })),
  toggleFolderFilter: (folderId) =>
    set((state) => ({
      notesFilter: {
        ...state.notesFilter,
        folders: state.notesFilter.folders.includes(folderId)
          ? state.notesFilter.folders.filter((item) => item !== folderId)
          : [...state.notesFilter.folders, folderId],
      },
    })),
  toggleTagFilter: (tag) =>
    set((state) => ({
      notesFilter: {
        ...state.notesFilter,
        tags: state.notesFilter.tags.includes(tag)
          ? state.notesFilter.tags.filter((item) => item !== tag)
          : [...state.notesFilter.tags, tag],
      },
    })),
  setUpdatedWindowDays: (updatedWindowDays) => set((state) => ({ notesFilter: { ...state.notesFilter, updatedWindowDays } })),
  resetNotesFilter: () => set({ notesFilter: DEFAULT_NOTES_FILTER }),
  saveCurrentFilter: (name) =>
    set((state) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return {};
      }

      const savedFilter = {
        id: `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        filter: state.notesFilter,
      };

      return {
        savedFilters: [savedFilter, ...state.savedFilters.filter((item) => item.name !== trimmedName)].slice(0, 12),
      };
    }),
  applySavedFilter: (id) =>
    set((state) => {
      const savedFilter = state.savedFilters.find((item) => item.id === id);

      return savedFilter ? { notesFilter: savedFilter.filter } : {};
    }),
  deleteSavedFilter: (id) => set((state) => ({ savedFilters: state.savedFilters.filter((item) => item.id !== id) })),
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  setDesktopSidebarOpen: (desktopSidebarOpen) => set({ desktopSidebarOpen }),
  toggleDesktopSidebar: () => set((state) => ({ desktopSidebarOpen: !state.desktopSidebarOpen })),
  toggleDesktopSidebarPinned: () =>
    set((state) => ({
      desktopSidebarPinned: !state.desktopSidebarPinned,
      desktopSidebarOpen: !state.desktopSidebarPinned || state.desktopSidebarOpen,
    })),
  setAiChatOpen: (aiChatOpen) => set({ aiChatOpen }),
  toggleAiChat: () => set((state) => ({ aiChatOpen: !state.aiChatOpen })),
  setDeveloperMode: (developerMode) => set({ developerMode }),
  toggleDeveloperMode: () => set((state) => ({ developerMode: !state.developerMode })),
}));
