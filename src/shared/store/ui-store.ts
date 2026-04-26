import { create } from "zustand";

import { DEFAULT_NOTES_FILTER, type NotesFilter, type NotesSort } from "@/features/notes/model/note-selectors";

export type AppView = "notes" | "favorites" | "archive" | "folder" | "folders" | "reminders" | "locked" | "trash" | "hidden_folders" | "admin_tools";

type UiState = {
  view: AppView;
  activeFolderId: string | null;
  searchQuery: string;
  notesFilter: NotesFilter;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  desktopSidebarPinned: boolean;
  setView: (view: AppView) => void;
  setActiveFolderId: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setNotesSort: (sort: NotesSort) => void;
  toggleFolderFilter: (folderId: string | null) => void;
  toggleTagFilter: (tag: string) => void;
  setUpdatedWindowDays: (days: number | null) => void;
  resetNotesFilter: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
  toggleDesktopSidebarPinned: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "notes",
  activeFolderId: null,
  searchQuery: "",
  notesFilter: DEFAULT_NOTES_FILTER,
  mobileSidebarOpen: false,
  desktopSidebarOpen: false,
  desktopSidebarPinned: false,
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
}));
