"use client";

import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";

const authStates = ["Email + password", "Google OAuth", "Google One Tap", "Redirect fallback", "Runtime config", "Profile sync"];

export function LoginShell() {
  const [splash, setSplash] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (splash) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <section className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-accent text-accent-foreground shadow-2xl shadow-violet-950/18">
            <Sparkles className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">SmartNotes</h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-foreground/48">AI-organized thinking</p>
          <Loader2 className="mx-auto mt-8 h-8 w-8 animate-spin text-accent" />
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen px-4 py-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-6 lg:p-6">
      <section className="hidden overflow-hidden rounded-[2.5rem] border border-border bg-foreground p-8 text-background shadow-2xl shadow-violet-950/16 lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link className="inline-flex items-center gap-2 rounded-full bg-background/10 px-4 py-2 text-sm font-bold text-background/78 hover:bg-background/16" href="/">
            <ArrowLeft className="h-4 w-4" />
            Назад к приложению
          </Link>
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.32em] text-background/48">Secure session</p>
          <h1 className="mt-4 max-w-xl text-5xl font-black tracking-tight">Вход без трения, но с жестким boot-контролем.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-background/68">
            Auth слой стартует после runtime config, поддерживает redirect persistence и деградирует без блокировки текстовой части приложения.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {authStates.map((state) => (
            <div className="rounded-3xl border border-background/10 bg-background/8 p-4" key={state}>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-bold text-background/82">{state}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center py-2 sm:py-4">
        <Link className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground/70 lg:hidden" href="/">
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Link>

        <div className="rounded-[2rem] border border-border bg-surface/90 p-5 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="h-6 w-6" />
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

          <Button className="mt-5 h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/92">
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-black text-foreground">G</span>
            Войти через Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/34">
            <span className="h-px flex-1 bg-border" />
            или
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3">
            <Field icon={Mail} label="Email" placeholder="you@example.com" type="email" />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-foreground/62">Пароль</span>
                <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5">
                <KeyRound className="h-5 w-5 text-foreground/34" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Минимум 8 символов" type={showPassword ? "text" : "password"} />
                <button className="text-foreground/38" onClick={() => setShowPassword((value) => !value)} type="button">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>
            {mode === "register" && <Field icon={KeyRound} label="Повторите пароль" placeholder="Еще раз пароль" type="password" />}

            {mode === "login" && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 font-semibold text-foreground/62"><input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" />Запомнить</label>
                <button className="font-bold text-accent" type="button">Забыли пароль?</button>
              </div>
            )}

            <Button className="h-12 w-full rounded-2xl text-base" type="button">{mode === "login" ? "Войти по email" : "Создать аккаунт"}</Button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({ icon: Icon, label, placeholder, type }: { icon: typeof Mail; label: string; placeholder: string; type: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-foreground/62">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2.5">
        <Icon className="h-5 w-5 text-foreground/34" />
        <input className="min-w-0 flex-1 bg-transparent outline-none" inputMode={type === "email" ? "email" : undefined} placeholder={placeholder} type={type} />
      </span>
    </label>
  );
}
