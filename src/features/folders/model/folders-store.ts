import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { Folder } from "@/entities/folder";

const starterFolders: Folder[] = [];

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function createSafeStorage() {
  if (typeof window === "undefined") {
    return memoryStorage;
  }

  return window.localStorage;
}

type FoldersState = {
  folders: Folder[];
  addFolder: (folder: Folder) => void;
  removeFolder: (folderId: string) => void;
  setFolders: (folders: Folder[]) => void;
  patchFolder: (folderId: string, patch: Partial<Folder>) => void;
};

export const useFoldersStore = create<FoldersState>()(
  persist(
    (set) => ({
      folders: starterFolders,
      addFolder: (folder) =>
        set((state) => ({
          folders: [...state.folders, folder].sort((left, right) => left.folderOrder - right.folderOrder),
        })),
      removeFolder: (folderId) =>
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== folderId),
        })),
      setFolders: (folders) => set({ folders }),
      patchFolder: (folderId, patch) =>
        set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder)),
        })),
    }),
    {
      name: "smartnotes-folders",
      version: 1,
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) => ({
        folders: state.folders,
      }),
    },
  ),
);
