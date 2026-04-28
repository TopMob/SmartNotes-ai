import type { Folder } from "@/entities/folder";
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from "@/shared/lib/local-storage";

const LOCAL_FOLDERS_KEY = "smartnotes:local:folders";

function readFolders() {
  return readJsonFromLocalStorage<Folder[]>(LOCAL_FOLDERS_KEY, []);
}

function writeFolders(folders: Folder[]) {
  writeJsonToLocalStorage(LOCAL_FOLDERS_KEY, folders);
}

export const localFoldersRepository = {
  async list() {
    return readFolders();
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
  async remove(folderId: string) {
    writeFolders(readFolders().filter((item) => item.id !== folderId));
  },
};
