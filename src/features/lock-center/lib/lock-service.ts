import type { Note, NoteLock } from "@/entities/note";
import { secureCompare, sha256 } from "@/shared/lib/crypto";

export async function createNoteLock(password: string): Promise<NoteLock> {
  const normalized = password.trim();

  if (!normalized) {
    throw new Error("PASSWORD_REQUIRED");
  }

  return {
    v: 1,
    hash: await sha256(normalized),
    hidden: true,
  };
}

export async function verifyNoteLock(lock: NoteLock, password: string) {
  const normalized = password.trim();

  if (!normalized) {
    return false;
  }

  return secureCompare(lock.hash, await sha256(normalized));
}

export function maskLockedPreview(noteId: string) {
  return `Защищенная заметка ${noteId.slice(0, 6)}. Введите пароль для просмотра.`;
}

export function canReadNoteContent(note: Pick<Note, "lock">) {
  return !note.lock?.hidden;
}

export function assertNoteContentReadable(note: Pick<Note, "lock">) {
  if (!canReadNoteContent(note)) {
    throw new Error("NOTE_LOCKED");
  }
}
