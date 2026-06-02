"use client";

import { Lock, Unlock, Loader2, X } from "lucide-react";
import { useState } from "react";

import { createNoteLock, verifyNoteLock } from "../lib/lock-service";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import type { Note } from "@/entities/note";
import { useLockStore } from "../model/lock-store";

type LockModalProps = {
  note: Note;
  isOpen: boolean;
  onClose: (success?: boolean) => void;
};

export function LockModal({ note, isOpen, onClose }: LockModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { patchNote } = useNoteActions();
  const unlockNote = useLockStore((s) => s.unlockNote);
  const lockNoteStore = useLockStore((s) => s.lockNote);

  if (!isOpen) return null;

  const isLocked = Boolean(note.lock);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 4) {
      setError("Пароль должен быть не менее 4 символов");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const lockData = await createNoteLock(password);
      await patchNote(note.id, { lock: lockData });
      unlockNote(note.id); // unlock it immediately for the current session
      onClose(true);
    } catch (err) {
      setError("Не удалось установить пароль");
    } finally {
      setLoading(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  async function handleRemovePassword() {
    setError("");
    setLoading(true);
    try {
      const isValid = await verifyNoteLock(note.lock!, password);
      if (!isValid) {
        setError("Неверный пароль");
        return;
      }
      await patchNote(note.id, { lock: null });
      lockNoteStore(note.id); // clean up store
      onClose(true);
    } catch (err) {
      setError("Не удалось снять защиту");
    } finally {
      setLoading(false);
      setPassword("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={loading ? undefined : () => onClose()} />

      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-border bg-surface-strong p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-foreground/50 transition hover:bg-background hover:text-foreground"
          onClick={() => onClose()}
          disabled={loading}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent mb-4">
            {isLocked ? <Unlock className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
          </div>
          <h2 className="text-xl font-black tracking-tight mb-2">
            {isLocked ? "Снять защиту" : "Защитить заметку"}
          </h2>
          <p className="text-sm text-foreground/60 mb-6">
            {isLocked 
              ? "Удалить пароль с этой заметки? Она станет доступна всем, у кого есть права." 
              : "Установите пароль, чтобы скрыть содержимое от посторонних."}
          </p>
        </div>

        {isLocked ? (
          <form onSubmit={(e) => { e.preventDefault(); void handleRemovePassword(); }} className="space-y-4">
            <input
              type="text"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              autoComplete="off"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              placeholder="Введите текущий пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {error && <p className="text-xs font-bold text-rose-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 text-sm font-bold text-rose-500 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Снять пароль"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <input
              type="text"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              autoComplete="off"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              placeholder="Придумайте пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <input
              type="text"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              autoComplete="off"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />

            {error && <p className="text-xs font-bold text-rose-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Установить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}