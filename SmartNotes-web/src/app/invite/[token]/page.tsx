"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Loader2, Shield, XCircle } from "lucide-react";
import { collabRepository } from "@/features/editor-collab/api/collab-repository";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { Button } from "@/shared/ui/button";
import { LogoMark } from "@/shared/ui/logo-mark";

type InviteDetails = {
  id: string;
  noteId: string;
  noteTitle: string;
  inviterEmail: string;
  inviterName: string | null;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted" | "rejected";
  expiresAt: string | null;
  type: "note" | "folder";
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const authStatus = useAuthStore((state) => state.status);
  const currentUser = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState<"pending" | "success" | "error" | "expired">("pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const data = await collabRepository.fetchInviteByToken(token);
        if (!data) {
          setStatus("error");
          setErrorMsg("Приглашение не найдено.");
          return;
        }

        if (data.status !== "pending") {
          setStatus("error");
          setErrorMsg(`Это приглашение уже было ${data.status === "accepted" ? "принято" : "отклонено"}.`);
          return;
        }

        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setStatus("expired");
          setErrorMsg("Срок действия этого приглашения истек.");
          return;
        }

        setInvite(data);
      } catch (err) {
        console.error("Error loading invite:", err);
        setStatus("error");
        setErrorMsg("Ошибка при проверке приглашения.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvite();
    }
  }, [token]);

  async function handleAccept() {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      await collabRepository.acceptInviteByToken(token, currentUser.id, invite?.type);
      setStatus("success");
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Не удалось принять приглашение.");
      setStatus("error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    setActionLoading(true);
    try {
      await collabRepository.rejectInviteByToken(token, invite?.type);
      router.push("/");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  function handleLoginRedirect() {
    router.push(`/login?next=/invite/${token}`);
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-4 sm:px-6 lg:p-6 overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] left-[5%] h-[35rem] w-[35rem] rounded-full bg-accent/8 opacity-20 blur-[120px]" />
        <div className="absolute -bottom-[10%] right-[5%] h-[35rem] w-[35rem] rounded-full bg-violet-600/8 opacity-20 blur-[120px]" />
      </div>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-[2.2rem] border border-border bg-surface/90 p-6 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl sm:p-8"
        >
          <div className="flex items-center gap-4 border-b border-border/60 pb-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/25">
              <LogoMark className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">SmartNotes AI</p>
              <h1 className="text-2xl font-black tracking-tight">Совместная работа</h1>
            </div>
          </div>

          {loading && status === "pending" && (
            <div className="flex flex-col items-center justify-center py-12 text-foreground/56 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm font-bold">Проверка ссылки-приглашения...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <h2 className="text-xl font-black text-foreground">Доступ получен!</h2>
              <p className="text-xs text-foreground/56">Вы успешно присоединились к {invite?.type === "folder" ? "папке" : "заметке"}. Перенаправляем на дашборд...</p>
            </div>
          )}

          {(status === "error" || status === "expired") && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <XCircle className="h-14 w-14 text-rose-400" />
              <h2 className="text-xl font-black text-foreground">Упс! Ссылка недействительна</h2>
              <p className="text-sm text-foreground/56 leading-relaxed">{errorMsg}</p>
              <Button onClick={() => router.push("/")} className="mt-4 rounded-xl px-6 font-bold h-11 w-full">
                На главную
              </Button>
            </div>
          )}

          {!loading && status === "pending" && invite && (
            <div className="py-6 space-y-6">
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-foreground/64">
                  Пользователь <span className="font-bold text-foreground">{invite.inviterName || invite.inviterEmail}</span> приглашает вас стать соавтором {invite.type === "folder" ? "папки" : "заметки"}:
                </p>
                <div className="rounded-2xl border border-border bg-surface-strong/60 p-4 text-center shadow-inner">
                  <h3 className="text-lg font-black text-accent">&quot;{invite.noteTitle}&quot;</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-background/50 border border-border/80 px-3 py-2 text-xs font-semibold text-foreground/64">
                  <Shield className="h-4 w-4 text-accent" />
                  <span>Роль: {invite.role === "editor" ? "Редактор" : "Читатель"}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-background/50 border border-border/80 px-3 py-2 text-xs font-semibold text-foreground/64">
                  <Clock className="h-4 w-4 text-violet-400" />
                  <span>7 дней действия</span>
                </div>
              </div>

              {authStatus === "loading" ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : !currentUser ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-3.5 text-xs text-violet-300 leading-relaxed font-medium">
                    Чтобы получить доступ, вам необходимо войти в систему под своим аккаунтом.
                  </div>
                  <Button onClick={handleLoginRedirect} className="w-full rounded-2xl h-12 text-sm font-black shadow-md">
                    Войти в аккаунт
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <Button
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="w-full rounded-2xl h-12 text-sm font-black shadow-md bg-accent text-background hover:opacity-90"
                  >
                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Принять приглашение"}
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={actionLoading}
                    variant="secondary"
                    className="w-full rounded-2xl h-12 text-sm font-bold hover:bg-surface-strong/80"
                  >
                    Отклонить
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </section>
    </main>
  );
}
