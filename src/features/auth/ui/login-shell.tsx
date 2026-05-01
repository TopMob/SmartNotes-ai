"use client";

import { Eye, EyeOff, KeyRound, Loader2, Mail, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { LogoMark } from "@/shared/ui/logo-mark";
import { Button } from "@/shared/ui/button";

/**
 * Prevent back-navigation out of the login screen for unauthenticated users.
 * Replaces the current history entry so pressing "Back" stays on /login.
 */
function usePreventBackNavigation() {
  useEffect(() => {
    // Push a state so we can intercept the popstate event
    window.history.pushState(null, "", window.location.href);

    function onPopState() {
      // Re-push to keep user on the current page
      window.history.pushState(null, "", window.location.href);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleOneTapWindow = typeof window & {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; cancel_on_tap_outside?: boolean }) => void;
        prompt: () => void;
        cancel?: () => void;
      };
    };
  };
};

const googleScriptId = "smartnotes-google-one-tap";

function supportsGoogleOneTap() {
  if (typeof window === "undefined") {
    return false;
  }

  return !window.navigator.userAgent.includes("Firefox");
}

export function LoginShell() {
  const [splash, setSplash] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const runtimeConfig = useAuthStore((state) => state.runtimeConfig);
  const { pending, error, message, loginWithEmail, registerWithEmail, loginWithGoogle, loginWithGoogleOneTap, loginAsGuest, resetPassword } = useAuthActions();

  // Prevent back navigation for unauthenticated users on the login screen
  usePreventBackNavigation();

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const googleClientId = runtimeConfig?.googleClientId;

    if (!googleClientId || !supportsGoogleOneTap()) {
      return;
    }

    const clientId = googleClientId;

    function initializeOneTap() {
      const google = (window as GoogleOneTapWindow).google;
      const googleId = google?.accounts?.id;

      if (!googleId) {
        return;
      }

      googleId.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => {
          if (response.credential) {
            void loginWithGoogleOneTap(response.credential);
          }
        },
        cancel_on_tap_outside: true,
      });
      googleId.prompt();
    }

    if ((window as GoogleOneTapWindow).google?.accounts?.id) {
      initializeOneTap();
      return;
    }

    let script = document.getElementById(googleScriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = googleScriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", initializeOneTap);

    return () => {
      script?.removeEventListener("load", initializeOneTap);
      (window as GoogleOneTapWindow).google?.accounts?.id?.cancel?.();
    };
  }, [loginWithGoogleOneTap, runtimeConfig?.googleClientId]);


  async function handleSubmit() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      return;
    }

    if (mode === "register") {
      if (password !== repeatPassword) {
        return;
      }

      await registerWithEmail(normalizedEmail, password);
      return;
    }

    await loginWithEmail(normalizedEmail, password);
  }

  if (splash) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <section className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-accent text-accent-foreground shadow-2xl shadow-violet-950/18">
            <LogoMark className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">SmartNotes</h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-foreground/48">AI-organized thinking</p>
          <Loader2 className="mx-auto mt-8 h-8 w-8 animate-spin text-accent" />
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-4 sm:px-6 lg:p-6">
      <section className="mx-auto flex w-full max-w-md flex-col justify-center py-2 sm:py-4">
        <div className="rounded-[2rem] border border-border bg-surface/90 p-5 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <LogoMark className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">SmartNotes</p>
              <h1 className="text-2xl font-black">{mode === "login" ? "Войти" : "Регистрация"}</h1>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-2xl bg-surface-strong p-1">
            <button className={`rounded-xl px-4 py-3 text-sm font-black ${mode === "login" ? "bg-foreground text-background" : "text-foreground/54"}`} onClick={() => setMode("login")} type="button">Вход</button>
            <button className={`rounded-xl px-4 py-3 text-sm font-black ${mode === "register" ? "bg-foreground text-background" : "text-foreground/54"}`} onClick={() => setMode("register")} type="button">Регистрация</button>
          </div>

          <Button className="mt-5 h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/92" disabled={pending} onClick={() => void loginWithGoogle()}>
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-black text-foreground">G</span>
            Войти через Google
            <span className="ml-auto flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-[10px] font-black">
              <Zap className="h-3 w-3" /> One Tap
            </span>
          </Button>
          <Button className="mt-3 h-12 w-full rounded-2xl" disabled={pending} onClick={() => setGuestDialogOpen(true)} type="button" variant="secondary">
            <UserRound className="mr-2 h-5 w-5" />
            Войти как гость
          </Button>
          {!runtimeConfig?.googleClientId ? (
            <p className="mt-3 rounded-2xl border border-border bg-surface-strong p-3 text-xs leading-5 text-foreground/58">
              Google One Tap включится после добавления `NEXT_PUBLIC_GOOGLE_CLIENT_ID` в переменные окружения.
            </p>
          ) : !supportsGoogleOneTap() ? (
            <p className="mt-3 rounded-2xl border border-border bg-surface-strong p-3 text-xs leading-5 text-foreground/58">
              Google One Tap отключен в Firefox, чтобы не засорять консоль служебными `gsi/status` ошибками. Обычный вход через Google выше работает.
            </p>
          ) : null}

          {/* Google One Tap rendered container */}
          <div className="mt-2" id="g_id_onload" />

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/34">
            <span className="h-px flex-1 bg-border" />
            или
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
            <Field icon={Mail} label="Email" onChange={setEmail} placeholder="you@example.com" type="email" value={email} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-foreground/62">Пароль</span>
                <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5">
                <KeyRound className="h-5 w-5 text-foreground/34" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" type={showPassword ? "text" : "password"} value={password} />
                <button className="text-foreground/38" onClick={() => setShowPassword((value) => !value)} type="button">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>
            {mode === "register" ? <Field icon={KeyRound} label="Повторите пароль" onChange={setRepeatPassword} placeholder="Еще раз пароль" type="password" value={repeatPassword} /> : null}

            {mode === "login" && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 font-semibold text-foreground/62"><input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" />Запомнить</label>
                <button className="font-bold text-accent" disabled={pending || !email.trim()} onClick={() => void resetPassword(email.trim())} type="button">Забыли пароль?</button>
              </div>
            )}

            {mode === "register" && repeatPassword && password !== repeatPassword ? <p className="text-sm text-rose-500">Пароли не совпадают.</p> : null}
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            <Button className="h-12 w-full rounded-2xl text-base" disabled={pending || !email.trim() || !password || (mode === "register" && password !== repeatPassword)} onClick={() => void handleSubmit()} type="button">{mode === "login" ? "Войти по email" : "Создать аккаунт"}</Button>
          </form>
        </div>
      </section>
      {guestDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-md">
          <section className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-5 shadow-2xl shadow-violet-950/20 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Гостевой режим</p>
                <h2 className="mt-2 text-2xl font-black">Гостевой аккаунт удалится через 10 минут</h2>
              </div>
              <button className="rounded-full bg-surface-strong p-2 text-foreground/62 hover:text-foreground" onClick={() => setGuestDialogOpen(false)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground/64">
              Все заметки, папки и настройки гостя будут автоматически удалены. Вы уверены, что хотите продолжить?
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button className="rounded-2xl" disabled={pending} onClick={() => void loginAsGuest()} type="button">
                Продолжить
              </Button>
              <Button className="rounded-2xl" disabled={pending} onClick={() => { setMode("register"); setGuestDialogOpen(false); }} type="button" variant="secondary">
                Нет, зарегистрировать аккаунт
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Field({ icon: Icon, label, placeholder, type, value, onChange }: { icon: typeof Mail; label: string; placeholder: string; type: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-foreground/62">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5">
        <Icon className="h-5 w-5 text-foreground/34" />
        <input className="min-w-0 flex-1 bg-transparent outline-none" inputMode={type === "email" ? "email" : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
      </span>
    </label>
  );
}
