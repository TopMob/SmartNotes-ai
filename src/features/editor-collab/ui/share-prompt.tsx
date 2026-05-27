"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Trash2, UserPlus, Shield, Clock } from "lucide-react";
import { collabRepository, type CollaboratorDetail, type PendingInviteDetail } from "../api/collab-repository";
import { useAuthStore } from "@/features/auth/model/auth-store";

type SharePromptProps = {
  noteId: string;
  noteTitle: string;
  ownerId: string;
  onClose: () => void;
};

export function SharePrompt({ noteId, noteTitle, ownerId, onClose }: SharePromptProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isOwner = currentUserId === ownerId;

  const [collaborators, setCollaborators] = useState<CollaboratorDetail[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<"editor" | "viewer">("editor");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const collabs = await collabRepository.fetchNoteCollaborators(noteId);
        const invites = await collabRepository.fetchPendingInvites(noteId);
        setCollaborators(collabs);
        setPendingInvites(invites);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [noteId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setErrorMsg("");
    setActionLoading(true);
    try {
      await collabRepository.createInvite(noteId, emailInput, roleInput);
      setEmailInput("");
      const invites = await collabRepository.fetchPendingInvites(noteId);
      setPendingInvites(invites);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Не удалось отправить приглашение.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!window.confirm("Отозвать это приглашение?")) return;
    setActionLoading(true);
    try {
      await collabRepository.cancelPendingInvite(inviteId);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeAccess(userId: string) {
    if (!window.confirm("Удалить пользователя из списка соавторов?")) return;
    setActionLoading(true);
    try {
      await collabRepository.revokeCollaboratorAccess(noteId, userId);
      setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  function handleCopyInviteLink(invite: PendingInviteDetail) {
    const inviteUrl = `${window.location.origin}/invite/${invite.token}`;
    void navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }

  return (
    <div className="mt-4 space-y-5 pb-6">
      <p className="text-xs text-foreground/56">
        Управление доступом к заметке <span className="font-semibold text-accent">&quot;{noteTitle}&quot;</span>.
      </p>

      {/* Invite Form (only visible to owner) */}
      {isOwner ? (
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/32" />
              <input
                type="email"
                required
                disabled={actionLoading}
                placeholder="email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <select
              value={roleInput}
              disabled={actionLoading}
              onChange={(e) => setRoleInput(e.target.value as "editor" | "viewer")}
              className="rounded-2xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-accent"
            >
              <option value="editor">Редактор</option>
              <option value="viewer">Читатель</option>
            </select>
            <button
              type="submit"
              disabled={actionLoading}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            </button>
          </div>
          {errorMsg && <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>}
        </form>
      ) : (
        <div className="rounded-2xl bg-surface-strong p-3 text-xs text-foreground/45 text-center">
          Только владелец заметки может управлять доступом и отправлять приглашения.
        </div>
      )}

      {/* Collaborators List */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/42">Соавторы</h3>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-foreground/32">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : collaborators.length === 0 ? (
          <p className="text-xs text-foreground/38 italic">Пока никто не добавлен в качестве соавтора.</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((collab) => (
              <div
                key={collab.userId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface-strong/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {collab.photoURL ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={collab.photoURL}
                      alt={collab.displayName || "Avatar"}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                      {(collab.displayName || collab.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground/90">
                      {collab.displayName || collab.email || "Пользователь"}
                    </p>
                    <p className="truncate text-xs text-foreground/45">{collab.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 rounded-xl bg-background/80 border border-border/80 px-2 py-1 text-[11px] font-black text-foreground/64">
                    <Shield className="h-3 w-3" />
                    {collab.role === "owner" ? "Владелец" : collab.role === "editor" ? "Редактор" : "Читатель"}
                  </span>

                  {isOwner && collab.userId !== currentUserId && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleRevokeAccess(collab.userId)}
                      className="rounded-xl p-2 text-rose-400 hover:bg-rose-500/10 transition"
                      title="Удалить соавтора"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites List */}
      {isOwner && pendingInvites.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/42">Ожидающие инвайты</h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-surface-strong/20 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground/80">{invite.inviteeEmail}</p>
                  <p className="flex items-center gap-1 text-[10px] text-foreground/45 mt-0.5">
                    <Clock className="h-3 w-3" />
                    Активно до: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "Не ограничено"} ({invite.role === "editor" ? "редактор" : "читатель"})
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyInviteLink(invite)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1.5 text-xs font-bold text-foreground/64 hover:bg-background transition"
                  >
                    {copiedInviteId === invite.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-accent" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Ссылка
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleCancelInvite(invite.id)}
                    className="rounded-xl p-2 text-rose-400 hover:bg-rose-500/10 transition"
                    title="Отозвать инвайт"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Close */}
      <div className="flex justify-end pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-surface-strong px-4 py-2.5 text-sm font-bold text-foreground/72 hover:bg-background transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}