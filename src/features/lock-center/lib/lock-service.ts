import type { Note, NoteLock } from "@/entities/note";
import { secureCompare, sha256 } from "@/shared/lib/crypto";

export async function createNoteLock(password: string): Promise<NoteLock> {
  const normalized = password.trim();

  if (!normalized) {
    throw new Error("PASSWORD_REQUIRED");
  }

  const salt = crypto.randomUUID();
  const hash = await sha256(salt + normalized);

  return {
    v: 2,
    hash,
    salt,
    hidden: true,
  };
}

export async function verifyNoteLock(lock: NoteLock, password: string) {
  const normalized = password.trim();

  if (!normalized) {
    return false;
  }

  // v1 locks have no salt — verify with plain hash for backward compatibility
  const expectedHash = lock.salt ? await sha256(lock.salt + normalized) : await sha256(normalized);
  return secureCompare(lock.hash, expectedHash);
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
