import { ArrowLeft, Eye, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

const authStates = [
  "Email + password",
  "Google OAuth",
  "Google One Tap",
  "Redirect fallback",
  "Runtime config bootstrap",
  "Profile backend sync",
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen px-4 py-5 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-6 lg:p-6">
      <section className="hidden overflow-hidden rounded-[2.5rem] border border-border bg-foreground p-8 text-background shadow-2xl shadow-violet-950/16 lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link className="inline-flex items-center gap-2 rounded-full bg-background/10 px-4 py-2 text-sm font-bold text-background/78 hover:bg-background/16" href="/">
            <ArrowLeft className="h-4 w-4" />
            Назад к приложению
          </Link>
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.32em] text-background/48">Secure session</p>
          <h1 className="mt-4 max-w-xl text-5xl font-black tracking-tight">Вход без трения, но с жестким boot-контролем.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-background/68">
            Auth слой должен стартовать только после runtime config, поддерживать redirect persistence и корректно деградировать при проблемах SDK.
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

      <section className="mx-auto flex w-full max-w-md flex-col justify-center py-4">
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
              <h1 className="text-2xl font-black">Войти</h1>
            </div>
          </div>

          <Button className="mt-7 h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/92">
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-black text-foreground">G</span>
            Продолжить с Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/34">
            <span className="h-px flex-1 bg-border" />
            или
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-foreground/62">Email</span>
              <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4">
                <Mail className="h-5 w-5 text-foreground/34" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" inputMode="email" placeholder="you@example.com" type="email" />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-foreground/62">Пароль</span>
              <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4">
                <KeyRound className="h-5 w-5 text-foreground/34" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Минимум 8 символов" type="password" />
                <Eye className="h-5 w-5 text-foreground/34" />
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 font-semibold text-foreground/62">
                <input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" />
                Запомнить
              </label>
              <button className="font-bold text-accent" type="button">Сбросить пароль</button>
            </div>

            <Button className="h-12 w-full rounded-2xl text-base" type="button">Войти</Button>
          </form>

          <p className="mt-5 text-center text-sm text-foreground/58">
            Нет аккаунта? <button className="font-black text-accent" type="button">Создать</button>
          </p>
        </div>

        <p className="mt-4 rounded-3xl border border-border bg-surface/70 p-4 text-sm leading-6 text-foreground/58">
          Заглушка UI: действия будут подключены к Supabase Auth после runtime config endpoint и нормализации профиля `uid/id/email/displayName/photoURL`.
        </p>
      </section>
    </main>
  );
}
