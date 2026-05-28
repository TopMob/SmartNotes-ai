import { Brain, Folder, Heart, RotateCcw, Shield, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { selectPinnedGroups } from "@/features/notes/model/note-selectors";
import { useSearchStore } from "@/features/search";
import { calculateScore } from "@/features/search/lib/search-engine";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { isAdminUser, getAdminEmails, saveAdminEmails } from "@/features/auth/lib/admin-acl";


import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { listPendingAiAnalysis, clearAiAnalysisQueue } from "@/services/ai/ai-queue";
import { listCollabDiagnostics, getMediaDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { listSyncQueue } from "@/services/sync/sync-queue";
import { getUiCopy } from "@/shared/lib/i18n";
import type { AppView } from "@/shared/store/ui-store";

import { NoteCard } from "./NoteCard";
import { InvitesMainView } from "./InvitesMainView";
import { Button } from "@/shared/ui/button";
import type { SheetAnchor, SheetName } from "./shared";

type MainSurfaceProps = {
  copy: ReturnType<typeof getUiCopy>;
  view: AppView;
  folders: FolderEntity[];
  hiddenFolders: FolderEntity[];
  trashedFolders: FolderEntity[];
  notes: Note[];
  activeFolder: FolderEntity | null;
  folderViewMode: "compact" | "full";
  notesPerPage: 5 | 10 | 20 | 50;
  onOpenFolder: (folder: FolderEntity) => void;
  onOpenNote: (noteId: string) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  onRefreshInvites?: () => void;
};

export function MainSurface({ copy, view, folders, hiddenFolders, trashedFolders, notes, activeFolder, folderViewMode, notesPerPage, onOpenFolder, onOpenNote, onOpenSheet, onRefreshInvites }: MainSurfaceProps) {
  const user = useAuthStore((s) => s.user);

  if (view === "invites") {
    return (
      <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl">
        <InvitesMainView onRefreshInvites={onRefreshInvites} />
      </section>
    );
  }

  if (view === "admin_tools") {
    if (!isAdminUser(user?.email)) {
      return (
        <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 p-6 shadow-xl backdrop-blur-2xl flex items-center justify-center text-center">
          <div>
            <h2 className="text-xl font-black text-rose-500">Доступ ограничен</h2>
            <p className="mt-2 text-sm text-foreground/56">Вы не имеете прав для просмотра этого раздела.</p>
          </div>
        </section>
      );
    }
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><AdminToolsView notes={notes} /></section>;
  }

  if (view === "hidden_folders") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText={copy.shell.hiddenFolders} folderViewMode={folderViewMode} folders={hiddenFolders} mode="hidden" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "folders") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText={copy.shell.folders} folderViewMode={folderViewMode} folders={folders} mode="active" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "trash") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><TrashView copy={copy} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} trashedFolders={trashedFolders} /></section>;
  }

  if (view === "folder" && activeFolder) {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><NotesView copy={copy} emptyText={copy.shell.prompts.noMatches} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={activeFolder.name} view={view} /></section>;
  }

  return (
    <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl">
      <NotesView
        copy={copy}
        emptyText="Здесь пока пусто"
        notes={notes}
        notesPerPage={notesPerPage}
        onOpenNote={onOpenNote}
        onOpenSheet={onOpenSheet}
        title={
          view === "favorites"
          ? copy.shell.favorites
            : view === "archive"
              ? copy.shell.archive
              : view === "reminders"
                ? copy.shell.reminders
                : view === "locked"
                  ? copy.shell.locked
                  : copy.shell.notes
        }
        view={view}
      />
    </section>
  );
}

function FoldersGrid({ folders, mode, emptyText, folderViewMode, onOpenFolder }: { folders: FolderEntity[]; mode: "active" | "hidden"; emptyText: string; folderViewMode: "compact" | "full"; onOpenFolder: (folder: FolderEntity) => void }) {
  const { data: notes = [] } = useNotesFlat();
  const { unhideFolder } = useFolderActions();

  if (!folders.length) {
    return (
    <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-foreground/6 text-foreground/34"><Folder className="h-9 w-9" /></div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{emptyText}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-3 sm:gap-[14px] sm:p-5">
      {folders.map((folder) => {
        const notesCount = notes.filter((note) => note.folderId === folder.id && !note.trashedAt).length;

        return (
            <div className="folder-card min-h-[15rem] rounded-[1.6rem] border border-border bg-surface-strong p-8 text-left shadow-lg shadow-violet-950/4 sm:min-h-[16.5rem]" key={folder.id}>
            <button className="block w-full text-left" onClick={() => onOpenFolder(folder)} type="button">
              <div className="flex items-center gap-2 text-accent"><Folder className="h-5 w-5" /></div>
              <h2 className="mt-4 text-[1.45rem] font-black tracking-tight">{folder.name}</h2>
              {folder.description ? <p className={`mt-2 text-sm text-foreground/56 ${folderViewMode === "compact" ? "line-clamp-3 leading-6" : "line-clamp-4 leading-7"}`}>{folder.description}</p> : null}
            </button>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-foreground/56">
              <span>{notesCount} заметок</span>
              {mode === "hidden" ? <button className="rounded-xl bg-background px-3 py-2 font-bold text-accent" onClick={() => void unhideFolder(folder.id)} type="button">Показать</button> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrashView({ copy, notes, notesPerPage, trashedFolders, onOpenNote, onOpenSheet }: { copy: ReturnType<typeof getUiCopy>; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; trashedFolders: FolderEntity[]; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
  const { permanentlyDeleteFolder, restoreFolder } = useFolderActions();
  const { clearTrash } = useNoteActions();

  return (
    <div className="content-scrollable space-y-6 p-3 sm:p-5">
      <div className="flex justify-end">
        <button className="rounded-2xl border border-border bg-surface-strong px-4 py-2 text-sm font-black text-rose-500" onClick={() => void clearTrash()} type="button">{copy.shell.actions.clear}</button>
      </div>
      {trashedFolders.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.deletedFolders}</div>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {trashedFolders.map((folder) => (
              <div className="rounded-[1.2rem] border border-dashed border-rose-300 bg-surface-strong p-5" key={folder.id}>
                <h3 className="text-base font-black tracking-tight">{folder.name}</h3>
                <p className="mt-2 text-sm text-foreground/56">{folder.description}</p>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-accent" onClick={() => void restoreFolder(folder.id)} type="button">{copy.shell.actions.restore}</button>
                  <button
                    className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-rose-500"
                    onClick={() => {
                      const confirmMsg = (copy.shell.dialogs?.folderDeleteConfirm || "Удалить папку «{name}»?").replace("{name}", folder.name);
                      if (window.confirm(confirmMsg)) {
                        void permanentlyDeleteFolder(folder.id);
                      }
                    }}
                    type="button"
                  >
                    {copy.shell.actions.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <NotesView copy={copy} emptyText={copy.shell.sections.trashEmpty} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={copy.shell.trash} view="trash" />
    </div>
  );
}

function NotesView({ copy, title: _title, notes, notesPerPage, emptyText: _emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const { data: folders = [] } = useFoldersQuery();
  const [displayLimit, setDisplayLimit] = useState<number>(notesPerPage);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  const searchState = useSearchStore();


  const filteredNotes = useMemo(() => {
    let result = notes;

    // 1. Text Query (Search Engine Detail)
    if (searchState.query.trim()) {
      result = result
        .map(note => ({ note, score: calculateScore(note, searchState.query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.note);
    }

    // 2. Tags
    if (searchState.tags.length > 0) {
      result = result.filter(n =>
        searchState.tags.some((tag: string) => n.userTags.includes(tag) || n.hiddenTags.includes(tag))
      );
    }

    // 3. Folders
    if (searchState.folders.length > 0) {
      result = result.filter(n => {
        if (searchState.folders.includes("none") && !n.folderId) return true;
        return n.folderId && searchState.folders.includes(n.folderId);
      });
    }

    // 4. Updated Window
    if (searchState.updatedWindowDays !== null) {
      const cutoff = Date.now() - (searchState.updatedWindowDays * 24 * 60 * 60 * 1000);
      result = result.filter(n => new Date(n.updatedAt).getTime() >= cutoff);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (searchState.sort) {
        case "alphabetical":
          return a.title.localeCompare(b.title);
        case "relevance":
          return (b.aiRelevance || 0) - (a.aiRelevance || 0);
        case "importance":
          return (b.aiRelevance || 0) - (a.aiRelevance || 0);
        case "textLength":
          return b.content.length - a.content.length;
        case "manual":
          return ((a as Record<string, unknown>).manualOrder as number || 0) - ((b as Record<string, unknown>).manualOrder as number || 0);
        case "updatedAt":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [notes, searchState]);


  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(filteredNotes), [filteredNotes]);


  const pinnedVisible = pinned.slice(0, displayLimit);
  const unpinnedVisible = unpinned.slice(0, Math.max(displayLimit - pinnedVisible.length, 0));
  const hasMore = displayLimit < notes.length;

  if (!notes.length) {
    return (
      <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-border bg-surface-strong px-6 py-8 shadow-xl shadow-violet-950/6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-accent/10 text-accent"><Sparkles className="h-9 w-9" /></div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Здесь пока пусто</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/58">Создайте первую заметку, чтобы она появилась в этом разделе.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-scrollable space-y-5 p-3 sm:p-4">
      {pinnedVisible.length ? (
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-accent">
            <Heart className="h-4 w-4" />
            {copy.shell.sections.pinned}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 sm:gap-[14px]">
            {pinnedVisible.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
            ))}
          </div>
        </section>
      ) : null}

      {unpinnedVisible.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.notes}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 sm:gap-[14px]">
            {unpinnedVisible.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
            ))}
          </div>
        </section>
      ) : null}

      {hasMore ? (
        <div className="mt-8 flex justify-center pb-8">
          <button
            className="rounded-2xl border border-border bg-surface-strong px-6 py-3 text-sm font-black text-foreground/72 hover:bg-surface transition-colors"
            onClick={() => setDisplayLimit(limit => limit + notesPerPage)}
            type="button"
          >
            {(copy.shell.actions as Record<string, string>)?.loadMore || "Показать еще"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AdminToolsView({ notes }: { notes: Note[] }) {
  const [tab, setTab] = useState<"overview" | "feedback" | "admins" | "diagnostics">("overview");

  // Feedback State
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Admin Emails State
  const user = useAuthStore((state) => state.user);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    setAdminEmails(getAdminEmails());
  }, []);

  useEffect(() => {
    if (tab === "feedback") {
      setLoadingFeedback(true);
      fetch("/api/admin/feedback")
        .then((res) => res.json())
        .then((data) => setFeedbackList(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Failed to fetch feedback:", err))
        .finally(() => setLoadingFeedback(false));
    }
  }, [tab]);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Некорректный формат почты");
      return;
    }

    if (adminEmails.includes(email)) {
      setEmailError("Почта уже добавлена");
      return;
    }

    const updated = [...adminEmails, email];
    setAdminEmails(updated);
    saveAdminEmails(updated);
    setNewEmail("");
    setEmailError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    if (emailToRemove === "shazak6430@gmail.com") return;
    if (emailToRemove === user?.email?.toLowerCase()) return;

    const updated = adminEmails.filter((email) => email !== emailToRemove);
    setAdminEmails(updated);
    saveAdminEmails(updated);
  };

  const pending = notes.filter((note) => note.aiStatus === "pending").length;
  const failed = notes.filter((note) => note.aiStatus === "error").length;
  const analyzing = notes.filter((note) => note.aiStatus === "analyzing").length;
  const queued = listPendingAiAnalysis().length;
  const syncBacklog = listSyncQueue().length;
  const collabSessions = listCollabDiagnostics().length;
  const mediaDiagnostic = getMediaDiagnostic();
  const collabDiagnostics = listCollabDiagnostics();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4 sm:p-6 pb-0">
        <h1 className="text-2xl font-black mb-6 tracking-tight">Admin Dashboard</h1>
        <div className="flex gap-4">
          {[
            { id: "overview", label: "Сводка" },
            { id: "feedback", label: "Отзывы" },
            { id: "admins", label: "Администраторы" },
            { id: "diagnostics", label: "Диагностика" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                tab === t.id ? "border-accent text-accent" : "border-transparent text-foreground/50 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="content-scrollable flex-1 p-4 sm:p-6 space-y-6">
        {tab === "overview" && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "AI pending / queued", value: `${pending} / ${queued}`, icon: Brain },
              { title: "AI analyzing / errors", value: `${analyzing} / ${failed}`, icon: Shield },
              { title: "Sync backlog", value: syncBacklog, icon: RotateCcw },
              { title: "Collab sessions", value: collabSessions, icon: Sparkles },
              { title: "Media mode", value: mediaDiagnostic.degraded ? "degraded" : mediaDiagnostic.provider, icon: Folder },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div className="rounded-[1.6rem] border border-border bg-surface-strong p-5 text-left shadow-lg shadow-violet-950/4" key={card.title}>
                  <div className="flex items-center gap-2 text-accent"><Icon className="h-5 w-5" /></div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight">{card.value}</h2>
                  <p className="mt-2 text-sm text-foreground/56">{card.title}</p>
                </div>
              );
            })}
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-4">
            {loadingFeedback ? (
              <div className="text-sm font-bold text-foreground/50">Загрузка отзывов...</div>
            ) : feedbackList.length === 0 ? (
              <div className="text-sm font-bold text-foreground/50">Отзывов пока нет.</div>
            ) : (
              feedbackList.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-surface-strong p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex bg-amber-400/10 text-amber-500 font-black px-2 py-1 rounded-lg text-xs items-center gap-1">
                        ★ {item.rating}
                      </div>
                      <div className="text-xs text-foreground/40 font-bold">
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-relaxed mb-4">
                    {item.comment || <span className="italic text-foreground/30">Без комментария</span>}
                  </p>
                  <div className="text-[10px] text-foreground/40 font-mono bg-background p-2 rounded-xl break-all">
                    UserAgent: {item.user_agent}<br/>
                    Language: {item.system_language}<br/>
                    {item.diagnostics_snapshot ? `Diagnostics: ${JSON.stringify(item.diagnostics_snapshot).substring(0, 100)}...` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "admins" && (
          <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5 max-w-xl">
            <h2 className="text-sm font-black mb-4">Управление администраторами</h2>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailError(null); }}
                placeholder="admin@example.com"
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none"
              />
              <Button className="rounded-2xl shrink-0" onClick={handleAddEmail} type="button">Добавить</Button>
            </div>
            {emailError && <p className="mt-2 text-xs text-rose-500 font-bold px-1">{emailError}</p>}
            
            <div className="mt-6 space-y-2">
              {adminEmails.map((email) => {
                const isMain = email === "shazak6430@gmail.com";
                const isSelf = email === user?.email?.toLowerCase();
                const canRemove = !isMain && !isSelf;

                return (
                  <div key={email} className="flex items-center justify-between gap-3 rounded-2xl bg-background border border-border px-4 py-3 text-sm font-semibold text-foreground/72">
                    <span className="truncate">{email}</span>
                    <div className="flex items-center gap-2">
                      {isMain && <span className="text-[10px] bg-accent/10 text-accent px-2 py-1 rounded-lg">Владелец</span>}
                      {isSelf && <span className="text-[10px] bg-foreground/10 text-foreground/70 px-2 py-1 rounded-lg">Вы</span>}
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveEmail(email)}
                          className="text-xs text-rose-500 hover:underline font-bold"
                          type="button"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "diagnostics" && (
          <div className="space-y-4">
            <div className="flex mb-4">
              <Button className="rounded-2xl" onClick={clearAiAnalysisQueue} type="button" variant="secondary">Очистить AI queue</Button>
            </div>
            
            <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
              <div className="text-sm font-black mb-2">Media System</div>
              <p className="text-sm text-foreground/56">{mediaDiagnostic.message}</p>
            </section>

            {collabDiagnostics.map((diagnostic) => (
              <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4" key={diagnostic.noteId}>
                <div className="text-sm font-black">{diagnostic.noteId}</div>
                <div className="mt-2 grid gap-2 text-sm text-foreground/64 sm:grid-cols-2">
                  <div>Status: {diagnostic.status}</div>
                  <div>Transport: {diagnostic.transport}</div>
                  <div>Persistence: {diagnostic.persistence}</div>
                  <div>Durable: {diagnostic.durable}</div>
                  <div>Hydrated: {diagnostic.hydratedFromQuery ? "yes" : "no"}</div>
                  <div>Updated: {new Date(diagnostic.updatedAt).toLocaleString("ru-RU")}</div>
                </div>
                {diagnostic.message ? <p className="mt-2 text-sm text-foreground/56">{diagnostic.message}</p> : null}
              </section>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
