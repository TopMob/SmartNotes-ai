import type { NoteLock } from "@/entities/note";
import { secureCompare, sha256 } from "@/shared/lib/crypto";

export async function createNoteLock(password: string): Promise<NoteLock> {
  const normalized = password.trim();

  if (!normalized) {
    throw new Error("PASSWORD_REQUIRED");
  }

  const saltBuffer = new Uint8Array(16);
  crypto.getRandomValues(saltBuffer);
  const salt = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

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


  const expectedHash = lock.salt ? await sha256(lock.salt + normalized) : await sha256(normalized);
  return await secureCompare(lock.hash, expectedHash);
}

export function maskLockedPreview(noteId: string) {
  return `Защищенная заметка ${noteId.slice(0, 6)}. Введите пароль для просмотра.`;
}
