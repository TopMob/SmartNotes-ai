import type { NoteLock } from "@/entities/note";
import { secureCompare, sha256 } from "@/shared/lib/crypto";

export async function createNoteLock(password: string): Promise<NoteLock> {
  return {
    v: 1,
    hash: await sha256(password),
    hidden: true,
  };
}

export async function verifyNoteLock(lock: NoteLock, password: string) {
  return secureCompare(lock.hash, await sha256(password));
}

export function maskLockedPreview(noteId: string) {
  return `Защищенная заметка ${noteId.slice(0, 6)}. Введите пароль для просмотра.`;
}
