import type { Folder, FolderDraft } from "@/entities/folder";

const FOLDER_NAME_MAX_LENGTH = 80;
const FOLDER_DESCRIPTION_SOFT_LIMIT = 280;

export function nowIso() {
  return new Date().toISOString();
}

export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  try {
    const crypto = require("crypto");
    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


export function normalizeFolderName(name: string) {
  return name.trim().slice(0, FOLDER_NAME_MAX_LENGTH) || "Новая папка";
}

export function normalizeFolderDescription(description: string | null) {
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
    id: createId(),
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

export function normalizeFolderPatch(patch: Partial<Folder>): Partial<Folder> {
  return {
    ...patch,
    ...(patch.name === undefined ? null : { name: normalizeFolderName(patch.name) }),
    ...(patch.description === undefined ? null : { description: normalizeFolderDescription(patch.description) }),
    updatedAt: nowIso(),
  };
}
