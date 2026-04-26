import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { Folder } from "@/entities/folder";

const starterFolders: Folder[] = [
  {
    id: "work",
    ownerId: "local-user",
    name: "Работа",
    description: "Проекты, задачи и рабочие заметки.",
    isHidden: false,
    isArchived: false,
    folderOrder: 0,
    accessRole: "owner",
    createdAt: new Date("2026-01-03").toISOString(),
    updatedAt: new Date("2026-04-26").toISOString(),
    trashedAt: null,
  },
  {
    id: "ideas",
    ownerId: "local-user",
    name: "Идеи продукта",
    description: "Фичи, гипотезы, концепты и заметки по UX.",
    isHidden: false,
    isArchived: false,
    folderOrder: 1,
    accessRole: "owner",
    createdAt: new Date("2026-01-11").toISOString(),
    updatedAt: new Date("2026-04-26").toISOString(),
    trashedAt: null,
  },
  {
    id: "study",
    ownerId: "local-user",
    name: "Учеба",
    description: "Материалы, исследования и черновики.",
    isHidden: false,
    isArchived: false,
    folderOrder: 2,
    accessRole: "owner",
    createdAt: new Date("2026-02-01").toISOString(),
    updatedAt: new Date("2026-04-20").toISOString(),
    trashedAt: null,
  },
  {
    id: "personal",
    ownerId: "local-user",
    name: "Личное",
    description: "Личные записи, планы и напоминания.",
    isHidden: false,
    isArchived: false,
    folderOrder: 3,
    accessRole: "owner",
    createdAt: new Date("2026-02-14").toISOString(),
    updatedAt: new Date("2026-04-18").toISOString(),
    trashedAt: null,
  },
];

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
