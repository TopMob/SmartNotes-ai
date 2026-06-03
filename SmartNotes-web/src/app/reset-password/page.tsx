"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";
import { LogoMark } from "@/shared/ui/logo-mark";
import { Button } from "@/shared/ui/button";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      setError("Supabase runtime config не задан. Сброс пароля недоступен.");
      setVerifying(false);
      return;
    }

    // Verify if there is an active session (set by the server during /auth/callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No session — redirect to login
        router.replace("/login?error=Срок действия ссылки истек или сессия не найдена.");
      } else {
        setVerifying(false);
      }
    }).catch((err) => {
      console.error("Session fetch error:", err);
      router.replace("/login?error=Ошибка проверки сессии.");
    });
  }, [supabase, router]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      // Automatically redirect to dashboard/home after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Не удалось обновить пароль");
    } finally {
      setPending(false);
    }
  }

  if (verifying) {
    return (
      <main className="relative flex flex-col min-h-[100dvh] justify-center items-center px-4 py-8 overflow-y-auto w-full">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
          <p className="text-sm text-foreground/64 font-medium">Проверка авторизации...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-col min-h-[100dvh] justify-start sm:justify-center items-center px-4 py-4 sm:py-8 overflow-y-auto w-full">
      {/* Ambient Glow Backdrops */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] left-[5%] h-[35rem] w-[35rem] rounded-full bg-accent/8 opacity-20 blur-[120px] sm:opacity-30" />
        <div className="absolute -bottom-[10%] right-[5%] h-[35rem] w-[35rem] rounded-full bg-violet-600/8 opacity-20 blur-[120px] sm:opacity-30" />
      </div>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center py-1 sm:py-3">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-[2rem] sm:rounded-[2.2rem] border border-border bg-surface/90 p-4 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl sm:p-6 w-full"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/25 shadow-[0_0_20px_rgba(0,242,255,0.1)]">
              <LogoMark className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-accent">SmartNotes AI</p>
              <h1 className="text-2xl font-black tracking-tight">Новый пароль</h1>
            </div>
          </div>

          <p className="mt-4 text-sm text-foreground/64 leading-relaxed font-medium">
            Пожалуйста, введите ваш новый пароль для восстановления доступа к аккаунту.
          </p>

          <form className="space-y-4 mt-6" onSubmit={handleReset}>
            {/* New Password */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-foreground/62">Новый пароль</span>
              <span className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2 focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all duration-200">
                <KeyRound className="h-5 w-5 text-foreground/34 transition-colors" />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none text-sm text-foreground"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  required
                  disabled={pending || success}
                />
                <button
                  className="text-foreground/38 hover:text-foreground/60 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            {/* Confirm Password */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-foreground/62">Повторите пароль</span>
              <span className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-2 focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all duration-200">
                <KeyRound className="h-5 w-5 text-foreground/34 transition-colors" />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none text-sm text-foreground"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Пароль еще раз"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  required
                  disabled={pending || success}
                />
                <button
                  className="text-foreground/38 hover:text-foreground/60 transition-colors"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  type="button"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-semibold text-rose-400"
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-semibold text-emerald-400"
                >
                  Пароль успешно изменен! Перенаправление...
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              className="h-11 w-full rounded-2xl text-base font-bold shadow-md hover:brightness-105 active:scale-[0.99] transition-all mt-6"
              disabled={pending || success || !password || !confirmPassword}
              type="submit"
            >
              {pending ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </span>
              ) : (
                "Сохранить пароль"
              )}
            </Button>
          </form>

          <div className="text-center text-sm mt-6">
            <a href="/login" className="text-accent hover:underline font-semibold transition-colors">
              Вернуться ко входу
            </a>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
