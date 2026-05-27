"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, KeyRound, Mail, UserRound, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { initGoogleOneTap } from "@/features/auth/lib/google-one-tap";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { LogoMark } from "@/shared/ui/logo-mark";
import { Button } from "@/shared/ui/button";

function usePreventBackNavigation() {
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    function onPopState() {
      window.history.pushState(null, "", window.location.href);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

export function LoginShell() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const status = useAuthStore((state) => state.status);
  const runtimeConfig = useAuthStore((state) => state.runtimeConfig);
  const { pending, error, message, loginWithEmail, registerWithEmail, loginWithGoogle, loginWithGoogleOneTap, loginAsGuest, resetPassword } = useAuthActions();

  usePreventBackNavigation();

  useEffect(() => {
    if (status === "authenticated") {
      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = searchParams.get("next");
      window.location.assign(nextPath || "/");
    }
  }, [status]);

  useEffect(() => {
    const googleClientId = runtimeConfig?.googleClientId;
    if (!googleClientId || status === "authenticated") return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void initGoogleOneTap(googleClientId, async (credential) => {
      await loginWithGoogleOneTap(credential);
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loginWithGoogleOneTap, runtimeConfig?.googleClientId, status]);

  async function handleSubmit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) return;

    if (mode === "register") {
      if (password !== repeatPassword) return;
      await registerWithEmail(normalizedEmail, password);
      return;
    }
    await loginWithEmail(normalizedEmail, password);
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-8 sm:px-6 lg:p-6 overflow-y-auto">
      {/* Ambient Glow Backdrops */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] left-[5%] h-[35rem] w-[35rem] rounded-full bg-accent/8 opacity-20 blur-[120px] sm:opacity-30" />
        <div className="absolute -bottom-[10%] right-[5%] h-[35rem] w-[35rem] rounded-full bg-violet-600/8 opacity-20 blur-[120px] sm:opacity-30" />
      </div>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center py-2 sm:py-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-[2.2rem] border border-border bg-surface/90 p-5 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl sm:p-7"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/25 shadow-[0_0_20px_rgba(0,242,255,0.1)]">
              <LogoMark className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">SmartNotes AI</p>
              <h1 className="text-2.5xl font-black tracking-tight">{mode === "login" ? "Войти" : "Регистрация"}</h1>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 rounded-2xl bg-surface-strong p-1">
            <button
              className={`relative z-10 rounded-xl px-4 py-3 text-sm font-black transition-colors duration-200 ${
                mode === "login" ? "text-background" : "text-foreground/54 hover:text-foreground"
              }`}
              onClick={() => setMode("login")}
              type="button"
            >
              Вход
            </button>
            <button
              className={`relative z-10 rounded-xl px-4 py-3 text-sm font-black transition-colors duration-200 ${
                mode === "register" ? "text-background" : "text-foreground/54 hover:text-foreground"
              }`}
              onClick={() => setMode("register")}
              type="button"
            >
              Регистрация
            </button>
            <AnimatePresence initial={false}>
              <motion.span
                layoutId="activeTab"
                className="absolute inset-y-1 left-1 right-1 my-0.5 rounded-xl bg-foreground"
                style={{
                  width: "calc(50% - 4px)",
                  left: mode === "login" ? "4px" : "calc(50% + 0px)",
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            </AnimatePresence>
          </div>

          <Button className="mt-5 h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-all" disabled={pending} onClick={() => void loginWithGoogle()}>
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-black text-foreground shadow-sm">G</span>
            Войти через Google
            <span className="ml-auto hidden sm:flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-[10px] font-black">
              <Zap className="h-3 w-3" /> One Tap
            </span>
          </Button>
          <Button className="mt-3 h-12 w-full rounded-2xl hover:bg-surface-strong/80 transition-all" disabled={pending} onClick={() => setGuestDialogOpen(true)} type="button" variant="secondary">
            <UserRound className="mr-2 h-5 w-5 text-foreground/72" />
            Войти как гость
          </Button>

          {!runtimeConfig?.googleClientId ? (
            <p className="mt-3 rounded-2xl border border-border bg-surface-strong p-3 text-xs leading-5 text-foreground/58">
              Добавьте <code className="font-mono text-accent">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> для включения входа через Google.
            </p>
          ) : null}

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/30">
            <span className="h-px flex-1 bg-border" />
            или
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            <Field icon={Mail} label="Email" onChange={setEmail} placeholder="you@example.com" type="email" value={email} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-foreground/62">Пароль</span>
              <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5 focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all duration-200">
                <KeyRound className="h-5 w-5 text-foreground/34 transition-colors" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" type={showPassword ? "text" : "password"} value={password} />
                <button className="text-foreground/38 hover:text-foreground/60 transition-colors" onClick={() => setShowPassword((value) => !value)} type="button">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <AnimatePresence initial={false}>
              {mode === "register" && (
                <motion.div
                  key="repeat-password-field"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <Field icon={KeyRound} label="Повторите пароль" onChange={setRepeatPassword} placeholder="Еще раз пароль" type="password" value={repeatPassword} />
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "login" && (
              <div className="flex items-center justify-between gap-3 text-sm pt-1">
                <label className="flex cursor-pointer select-none items-center gap-2 font-semibold text-foreground/62 hover:text-foreground transition-colors">
                  <input className="h-4 w-4 rounded border-border bg-surface-strong accent-[var(--accent)] transition-all focus:ring-accent/20" type="checkbox" />
                  Запомнить меня
                </label>
                <button className="font-bold text-accent hover:text-accent/80 transition-colors" disabled={pending || !email.trim()} onClick={() => void resetPassword(email.trim())} type="button">Забыли пароль?</button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === "register" && repeatPassword && password !== repeatPassword && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-semibold text-rose-400">
                  Пароли не совпадают.
                </motion.p>
              )}
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-semibold text-rose-400">
                  {error}
                </motion.p>
              )}
              {message && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-semibold text-emerald-400">
                  {message}
                </motion.p>
              )}
            </AnimatePresence>

            <Button className="h-12 w-full rounded-2xl text-base font-bold shadow-md hover:brightness-105 active:scale-[0.99] transition-all mt-6" disabled={pending || !email.trim() || !password || (mode === "register" && password !== repeatPassword)} onClick={() => void handleSubmit()} type="button">
              {mode === "login" ? "Войти по email" : "Создать аккаунт"}
            </Button>
          </form>
        </motion.div>
      </section>

      <AnimatePresence>
        {guestDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-md"
          >
            <motion.section
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="w-full max-w-md rounded-[2.2rem] border border-border bg-surface-strong/95 p-5 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Гостевой режим</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">Гостевой аккаунт удалится через 10 минут</h2>
                </div>
                <button className="rounded-full bg-surface p-2 text-foreground/62 hover:text-foreground hover:bg-surface-strong/50 transition-colors" onClick={() => setGuestDialogOpen(false)} type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/64 font-medium">
                Все заметки, папки и настройки гостя будут автоматически удалены. Вы уверены, что хотите продолжить?
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button className="rounded-xl h-11 transition-all" disabled={pending} onClick={() => void loginAsGuest()} type="button">
                  Продолжить
                </Button>
                <Button className="rounded-xl h-11 transition-all" disabled={pending} onClick={() => { setMode("register"); setGuestDialogOpen(false); }} type="button" variant="secondary">
                  Регистрация
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Field({ icon: Icon, label, placeholder, type, value, onChange }: { icon: React.ElementType; label: string; placeholder: string; type: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-foreground/62">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5 focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all duration-200">
        <Icon className="h-5 w-5 text-foreground/34 transition-colors" />
        <input className="min-w-0 flex-1 bg-transparent outline-none" inputMode={type === "email" ? "email" : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
      </span>
    </label>
  );
}