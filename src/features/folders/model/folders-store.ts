import { create } from "zustand";

import type { Folder } from "@/entities/folder";

type FoldersState = {
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  patchFolder: (folderId: string, patch: Partial<Folder>) => void;
};

export const useFoldersStore = create<FoldersState>((set) => ({
  folders: [],
  setFolders: (folders) => set({ folders }),
  patchFolder: (folderId, patch) =>
    set((state) => ({
      folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder)),
    })),
}));
