import { Check, X, Users, Mail, Bookmark, Folder, Loader2 } from "lucide-react";
import React, { useState } from "react";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { collabRepository } from "@/features/editor-collab/api/collab-repository";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { getUiCopy } from "@/shared/lib/i18n";
import { Button } from "@/shared/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useInvitesQuery } from "@/features/notes/hooks/use-notes-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

type HeaderInvite = {
  id: string;
  noteId: string;
  noteTitle: string;
  inviterEmail: string;
  inviterName: string | null;
  role: "owner" | "editor" | "viewer";
  token: string;
  expiresAt: string | null;
  createdAt: string;
  type: "note" | "folder";
};

type InvitesMainViewProps = {
  onRefreshInvites?: () => void;
};

export function InvitesMainView({ onRefreshInvites }: InvitesMainViewProps) {
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: myInvites = [], isLoading } = useInvitesQuery();

  async function handleAcceptInvite(invite: HeaderInvite) {
    if (!user || processingId) return;
    setProcessingId(invite.id);
    try {
      await collabRepository.acceptInviteByToken(invite.token, user.id, invite.type);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invites"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders(user.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notes(user.id) }),
      ]);
      onRefreshInvites?.();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectInvite(invite: HeaderInvite) {
    if (processingId) return;
    setProcessingId(invite.id);
    try {
      await collabRepository.rejectInviteByToken(invite.token, invite.type);
      await queryClient.invalidateQueries({ queryKey: ["invites"] });
      onRefreshInvites?.();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  }

  const dlgs = copy.shell.dialogs;

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-bold text-foreground/50">
            {lang === "ru" ? "Загрузка приглашений..." : "Loading invites..."}
          </p>
        </div>
      </div>
    );
  }

  if (myInvites.length === 0) {
    return (
      <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-border bg-surface-strong px-6 py-8 shadow-xl shadow-violet-950/6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-accent/10 text-accent">
            <Users className="h-9 w-9" />
          </div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">
            {lang === "ru" ? "Приглашений нет" : "No invitations"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground/58">
            {lang === "ru" ? "У вас нет ожидающих приглашений совместного доступа." : "You have no pending collaboration invitations."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-scrollable p-3 sm:p-5">
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {dlgs?.collabInvites || "Приглашения"}
        </h1>
        <p className="text-xs text-foreground/50 sm:text-sm mt-1">
          {lang === "ru" 
            ? "Управление входящими запросами совместного доступа к заметкам." 
            : "Manage incoming collaboration requests for shared notes."}
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {myInvites.map((invite) => (
          <div 
            key={invite.id} 
            className="flex flex-col justify-between rounded-[1.6rem] border border-border bg-surface-strong p-5 shadow-lg shadow-violet-950/4 hover:border-accent/40 transition-colors"
          >
            <div>
               <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-accent/12 px-3 py-1 text-xs font-black text-accent uppercase tracking-wider">
                  {invite.type === "folder" ? <Folder className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                  {invite.type === "folder" ? (lang === "ru" ? "Папка" : "Folder") : (lang === "ru" ? "Заметка" : "Note")}
                  {" • "}
                  {invite.role}
                </span>
              </div>
              
              <h2 className="mt-3.5 text-lg font-black tracking-tight text-foreground line-clamp-2 leading-snug">
                {invite.noteTitle || (lang === "ru" ? "Без названия" : "Untitled")}
              </h2>

              <div className="mt-3 flex items-center gap-2 text-xs text-foreground/54">
                <Mail className="h-3.5 w-3.5 shrink-0 text-foreground/34" />
                <span className="truncate" title={invite.inviterEmail}>
                  {(dlgs?.collabInviteFrom || "От") + ": " + (invite.inviterName ? `${invite.inviterName} (${invite.inviterEmail})` : invite.inviterEmail)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => void handleAcceptInvite(invite)}
                disabled={processingId !== null}
                className="flex-1 rounded-xl h-10 text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 transition-all flex items-center justify-center gap-1.5"
                type="button"
              >
                {processingId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {dlgs?.collabAccept || "Принять"}
              </Button>
              <Button
                onClick={() => void handleRejectInvite(invite)}
                disabled={processingId !== null}
                className="rounded-xl h-10 border border-border bg-background px-4 text-xs font-bold text-foreground/64 hover:bg-surface-strong transition-all flex items-center justify-center gap-1.5"
                type="button"
                variant="secondary"
              >
                <X className="h-4 w-4" />
                {dlgs?.collabReject || "Отклонить"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
