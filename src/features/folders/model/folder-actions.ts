import type { Folder, FolderDraft } from "@/entities/folder";

import { foldersRepository } from "@/features/folders/api/folders-repository";

import { useFoldersStore } from "./folders-store";

const FOLDER_NAME_MAX_LENGTH = 80;
const FOLDER_DESCRIPTION_SOFT_LIMIT = 280;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFolderName(name: string) {
  return name.trim().slice(0, FOLDER_NAME_MAX_LENGTH) || "Новая папка";
}

function normalizeFolderDescription(description: string | null) {
  if (!description) {
    return null;
  }

  const trimmed = description.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, FOLDER_DESCRIPTION_SOFT_LIMIT);
}

export function createLocalFolder(draft: FolderDraft, ownerId: string, folderOrder: number): Folder {
  const createdAt = nowIso();

  return {
    id: createId("folder"),
    ownerId,
    name: normalizeFolderName(draft.name),
    description: normalizeFolderDescription(draft.description),
    isHidden: draft.isHidden,
    isArchived: false,
    folderOrder,
    accessRole: "owner",
    createdAt,
    updatedAt: createdAt,
    trashedAt: null,
  };
}

export async function addFolder(draft: FolderDraft, ownerId: string) {
  const folders = useFoldersStore.getState().folders;
  const nextOrder = folders.length ? Math.max(...folders.map((folder) => folder.folderOrder)) + 1 : 0;
  const optimisticFolder = createLocalFolder(draft, ownerId, nextOrder);

  useFoldersStore.getState().addFolder(optimisticFolder);

  try {
    const folder = await foldersRepository.create(draft, ownerId, nextOrder);
    useFoldersStore.getState().removeFolder(optimisticFolder.id);
    useFoldersStore.getState().addFolder(folder);
    return folder;
  } catch (error) {
    useFoldersStore.getState().removeFolder(optimisticFolder.id);
    throw error;
  }
}

export async function patchFolder(folderId: string, patch: Partial<Folder>) {
  const currentFolder = useFoldersStore.getState().folders.find((folder) => folder.id === folderId);

  if (!currentFolder) {
    return;
  }

  const finalPatch: Partial<Folder> = {
    ...patch,
    ...(patch.name === undefined ? null : { name: normalizeFolderName(patch.name) }),
    ...(patch.description === undefined ? null : { description: normalizeFolderDescription(patch.description) }),
    updatedAt: nowIso(),
  };

  useFoldersStore.getState().patchFolder(folderId, finalPatch);

  try {
    const updatedFolder = await foldersRepository.patch(folderId, finalPatch);
    useFoldersStore.getState().patchFolder(folderId, updatedFolder);
  } catch (error) {
    useFoldersStore.getState().patchFolder(folderId, currentFolder);
    throw error;
  }
}

export function renameFolder(folderId: string, name: string) {
  return patchFolder(folderId, { name });
}

export function updateFolderDescription(folderId: string, description: string | null) {
  return patchFolder(folderId, { description });
}

export function hideFolder(folderId: string) {
  return patchFolder(folderId, { isHidden: true });
}

export function unhideFolder(folderId: string) {
  return patchFolder(folderId, { isHidden: false });
}

export function trashFolder(folderId: string) {
  return patchFolder(folderId, { trashedAt: nowIso() });
}

export function restoreFolder(folderId: string) {
  return patchFolder(folderId, { trashedAt: null });
}

export async function permanentlyDeleteFolder(folderId: string) {
  const currentFolder = useFoldersStore.getState().folders.find((folder) => folder.id === folderId);

  if (!currentFolder) {
    return;
  }

  useFoldersStore.getState().removeFolder(folderId);

  try {
    await foldersRepository.remove(folderId);
  } catch (error) {
    useFoldersStore.getState().addFolder(currentFolder);
    throw error;
  }
}
