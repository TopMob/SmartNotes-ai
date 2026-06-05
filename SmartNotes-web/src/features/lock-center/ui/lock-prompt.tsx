"use client";

import { Lock, Loader2 } from "lucide-react";
import { useState } from "react";

import { verifyNoteLock } from "../lib/lock-service";
import { useLockStore } from "../model/lock-store";
import type { NoteLock } from "@/entities/note";

type LockPromptProps = {
  noteId: string;
  lock: NoteLock;
  onCancel?: () => void;
};

export function LockPrompt({ noteId, lock, onCancel }: LockPromptProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const unlockNote = useLockStore((s) => s.unlockNote);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isValid = await verifyNoteLock(lock, password);
      if (isValid) {
        unlockNote(noteId);
      } else {
        setError("Неверный пароль");
        setPassword("");
      }
    } catch {
      setError("Ошибка проверки пароля");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-border bg-surface-strong p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent mb-6">
          <Lock className="h-8 w-8" />
        </div>
        
        <h2 className="text-2xl font-black tracking-tight mb-2">Заметка защищена</h2>
        <p className="text-sm text-foreground/60 mb-6">
          Введите пароль для просмотра содержимого.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <input
            id="lock_password"
            name="lock_password"
            type="text"
            style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
            autoComplete="off"
            autoFocus
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            placeholder="Ваш пароль..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          
          {error && <p className="text-xs font-bold text-rose-500 text-center">{error}</p>}

          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition hover:bg-surface-strong"
              >
                Отмена
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Разблокировать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}