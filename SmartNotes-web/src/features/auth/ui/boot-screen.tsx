"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoMark } from "@/shared/ui/logo-mark";

type Locale = "ru" | "en";

const copy: Record<Locale, {
  booting: string;
  slow: string;
  offlineTitle: string;
  offlineBody: string;
  retry: string;
  continueOffline: string;
}> = {
  ru: {
    booting: "Загружаем SmartNotes…",
    slow: "Проверяем соединение с сервером…",
    offlineTitle: "Нет связи с сервером",
    offlineBody: "Не удалось подключиться к облаку. Возможно, провайдер ограничивает доступ — попробуйте VPN. Пока продолжаем в офлайн-режиме: заметки сохраняются на этом устройстве.",
    retry: "Повторить",
    continueOffline: "Продолжить офлайн",
  },
  en: {
    booting: "Loading SmartNotes…",
    slow: "Checking the connection to the server…",
    offlineTitle: "No connection to the server",
    offlineBody: "Couldn't reach the cloud. Your network may be restricting access — try a VPN. For now you can keep working offline: notes are saved on this device.",
    retry: "Retry",
    continueOffline: "Continue offline",
  },
};

/** Picks a locale once on the client; defaults to `ru` to keep SSR markup stable. */
function useBootLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("ru");
  useEffect(() => {
    const lang = (document.documentElement.lang || navigator.language || "ru").toLowerCase();
    setLocale(lang.startsWith("en") ? "en" : "ru");
  }, []);
  return locale;
}

/**
 * Full-screen branded splash shown while auth bootstrap is in flight, so the user
 * never stares at a blank page. After a short delay it explains that we're still
 * waiting on the network (common on throttled RU connections).
 */
export function BootSplash() {
  const t = copy[useBootLocale()];
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 2500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: "var(--wallpaper, var(--background))" }}
      role="status"
      aria-live="polite"
    >
      <LogoMark className="h-16 w-16 text-accent" />
      <div className="flex items-center gap-2 text-sm text-foreground/80">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t.booting}</span>
      </div>
      <p
        className={`max-w-xs text-xs text-foreground/45 transition-opacity duration-500 ${slow ? "opacity-100" : "opacity-0"}`}
      >
        {t.slow}
      </p>
    </div>
  );
}

/**
 * Slim, non-blocking banner shown when we fell back to offline/local mode because
 * the backend was unreachable. Lets the user retry without losing the working UI.
 */
export function ConnectionBanner() {
  const t = copy[useBootLocale()];

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex items-start justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-md items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left shadow-lg backdrop-blur">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-200">{t.offlineTitle}</p>
          <p className="text-xs leading-relaxed text-amber-100/70">{t.offlineBody}</p>
          <div className="mt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-amber-400/90 px-3 py-1 text-xs font-medium text-amber-950 transition hover:bg-amber-300"
            >
              {t.retry}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
