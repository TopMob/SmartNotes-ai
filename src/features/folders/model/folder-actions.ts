import type { Folder, FolderDraft } from "@/entities/folder";
import { enqueueSyncItem } from "@/services/sync/sync-queue";

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

function queueFolderSync(folderId: string, operation: "create" | "patch" | "delete", payload: unknown) {
  enqueueSyncItem({
    id: `${operation}_${folderId}_${Date.now().toString(36)}`,
    entity: "folder",
    operation,
    payload,
  });
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

export function addFolder(draft: FolderDraft, ownerId: string) {
  const folders = useFoldersStore.getState().folders;
  const nextOrder = folders.length ? Math.max(...folders.map((folder) => folder.folderOrder)) + 1 : 0;
  const folder = createLocalFolder(draft, ownerId, nextOrder);

  useFoldersStore.getState().addFolder(folder);
  queueFolderSync(folder.id, "create", { folder });

  return folder;
}

export function patchFolder(folderId: string, patch: Partial<Folder>) {
  const finalPatch: Partial<Folder> = {
    ...patch,
    ...(patch.name === undefined ? null : { name: normalizeFolderName(patch.name) }),
    ...(patch.description === undefined ? null : { description: normalizeFolderDescription(patch.description) }),
    updatedAt: nowIso(),
  };

  useFoldersStore.getState().patchFolder(folderId, finalPatch);
  queueFolderSync(folderId, "patch", { folderId, patch: finalPatch });
}

export function renameFolder(folderId: string, name: string) {
  patchFolder(folderId, { name });
}

export function updateFolderDescription(folderId: string, description: string | null) {
  patchFolder(folderId, { description });
}

export function hideFolder(folderId: string) {
  patchFolder(folderId, { isHidden: true });
}

export function unhideFolder(folderId: string) {
  patchFolder(folderId, { isHidden: false });
}

export function trashFolder(folderId: string) {
  patchFolder(folderId, { trashedAt: nowIso() });
}

export function restoreFolder(folderId: string) {
  patchFolder(folderId, { trashedAt: null });
}

export function permanentlyDeleteFolder(folderId: string) {
  useFoldersStore.getState().removeFolder(folderId);
  queueFolderSync(folderId, "delete", { folderId });
}
