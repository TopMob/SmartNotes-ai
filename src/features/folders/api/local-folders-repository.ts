import type { Folder } from "@/entities/folder";
import { getLocalUserScope } from "@/features/auth/lib/local-user-scope";
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from "@/shared/lib/local-storage";

function getLocalFoldersKey() {
  return `smartnotes:local:folders:${getLocalUserScope()}`;
}

function readFolders() {
  const scopedFolders = readJsonFromLocalStorage<Folder[]>(getLocalFoldersKey(), []);

  if (scopedFolders.length) {
    return scopedFolders;
  }

  if (getLocalUserScope() === "local-user") {
    return readJsonFromLocalStorage<Folder[]>("smartnotes:local:folders", []);
  }

  return scopedFolders;
}

function writeFolders(folders: Folder[]) {
  writeJsonToLocalStorage(getLocalFoldersKey(), folders);
}

export const localFoldersRepository = {
  async list() {
    return readFolders().sort((left, right) => left.folderOrder - right.folderOrder);
  },
  async create(folder: Folder) {
    const folders = readFolders();
    writeFolders([...folders.filter((item) => item.id !== folder.id), folder]);
    return folder;
  },
  async patch(folderId: string, patch: Partial<Folder>) {
    const folders = readFolders();
    const current = folders.find((item) => item.id === folderId);

    if (!current) {
      throw new Error(`Local folder ${folderId} not found.`);
    }

    const updated = { ...current, ...patch };
    writeFolders(folders.map((item) => (item.id === folderId ? updated : item)));
    return updated;
  },
  async reorder(updates: Array<{ folderId: string; folderOrder: number }>) {
    const orderById = new Map(updates.map((item) => [item.folderId, item.folderOrder]));
    const folders = readFolders().map((folder) => {
      const folderOrder = orderById.get(folder.id);

      return folderOrder === undefined ? folder : { ...folder, folderOrder, updatedAt: new Date().toISOString() };
    });

    writeFolders(folders);
    return folders.sort((left, right) => left.folderOrder - right.folderOrder);
  },
  async remove(folderId: string) {
    writeFolders(readFolders().filter((item) => item.id !== folderId));
  },
};
