import { Brain, Folder, Heart, RotateCcw, Shield, Sparkles } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { selectPinnedGroups } from "@/features/notes/model/note-selectors";
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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { useUiStore } from "@/shared/store/ui-store";
import type { SheetAnchor, SheetName } from "./shared";

type MainSurfaceProps = {
  copy: ReturnType<typeof getUiCopy>;
  view: AppView;
  folders: FolderEntity[];
  hiddenFolders: FolderEntity[];
  trashedFolders: FolderEntity[];
  notes: Note[];
  semanticNotes: Note[];
  semanticLoading: boolean;
  activeFolder: FolderEntity | null;
  folderViewMode: "compact" | "full";
  notesPerPage: number;
  onOpenFolder: (folder: FolderEntity) => void;
  onOpenNote: (noteId: string) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  onRefreshInvites?: () => void;
};

export function MainSurface({ copy, view, folders, hiddenFolders, trashedFolders, notes, semanticNotes, semanticLoading, activeFolder, folderViewMode, notesPerPage, onOpenFolder, onOpenNote, onOpenSheet, onRefreshInvites }: MainSurfaceProps) {
  const user = useAuthStore((s) => s.user);

  if (view === "invites") {
    return (
      <section className="flex flex-col flex-1 min-h-0">
        <InvitesMainView onRefreshInvites={onRefreshInvites} />
      </section>
    );
  }

  if (view === "admin_tools") {
    if (!isAdminUser(user?.email)) {
      return (
        <section className="flex flex-col flex-1 min-h-0 p-6 flex items-center justify-center text-center">
          <div>
            <h2 className="text-xl font-black text-rose-500">Доступ ограничен</h2>
            <p className="mt-2 text-sm text-foreground/56">Вы не имеете прав для просмотра этого раздела.</p>
          </div>
        </section>
      );
    }
    return <section className="flex flex-col flex-1 min-h-0"><AdminToolsView notes={notes} /></section>;
  }

  if (view === "hidden_folders") {
    return <section className="flex flex-col flex-1 min-h-0"><FoldersGrid emptyText={copy.shell.hiddenFolders} folderViewMode={folderViewMode} folders={hiddenFolders} mode="hidden" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "folders") {
    return <section className="flex flex-col flex-1 min-h-0"><FoldersGrid emptyText={copy.shell.folders} folderViewMode={folderViewMode} folders={folders} mode="active" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "trash") {
    return <section className="flex flex-col flex-1 min-h-0"><TrashView copy={copy} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} trashedFolders={trashedFolders} /></section>;
  }

  if (view === "folder" && activeFolder) {
    return <section className="flex flex-col flex-1 min-h-0"><NotesView copy={copy} emptyText={copy.shell.prompts.noMatches} notes={notes} semanticLoading={semanticLoading} semanticNotes={semanticNotes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={activeFolder.name} view={view} /></section>;
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <NotesView
        copy={copy}
        emptyText="Здесь пока пусто"
        notes={notes}
        semanticLoading={semanticLoading}
        semanticNotes={semanticNotes}
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
  const notesCountByFolderId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const note of notes) {
      if (!note.folderId || note.trashedAt) {
        continue;
      }

      counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1);
    }

    return counts;
  }, [notes]);

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
    <div className="content-scrollable flex-1 min-h-0">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-3 sm:gap-[14px] sm:p-5">
        {folders.map((folder) => {
          const notesCount = notesCountByFolderId.get(folder.id) ?? 0;

          return (
            <div className="folder-card min-h-[15rem] rounded-[1.6rem] border border-border bg-surface-strong p-6 sm:p-8 text-left shadow-lg shadow-violet-950/4 sm:min-h-[16.5rem] flex flex-col justify-between h-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-violet-950/8" key={folder.id}>
              <button className="flex flex-col flex-1 w-full text-left" onClick={() => onOpenFolder(folder)} type="button">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 text-accent"><Folder className="h-5 w-5" /></div>
                  <h2 className="mt-4 text-[1.45rem] font-black tracking-tight">{folder.name}</h2>
                  {folder.description ? <p className={`mt-2 text-sm text-foreground/56 ${folderViewMode === "compact" ? "line-clamp-3 leading-6" : "line-clamp-4 leading-7"}`}>{folder.description}</p> : null}
                </div>
              </button>
              <div className="mt-auto pt-4 flex items-center justify-between gap-3 text-sm text-foreground/56 w-full">
                <span>{notesCount} заметок</span>
                {mode === "hidden" ? <button className="rounded-xl bg-background px-3 py-2 font-bold text-accent" onClick={() => void unhideFolder(folder.id)} type="button">Показать</button> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrashView({ copy, notes, notesPerPage, trashedFolders, onOpenNote, onOpenSheet }: { copy: ReturnType<typeof getUiCopy>; notes: Note[]; notesPerPage: number; trashedFolders: FolderEntity[]; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
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

      <NotesView copy={copy} emptyText={copy.shell.sections.trashEmpty} notes={notes} semanticNotes={[]} semanticLoading={false} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={copy.shell.trash} view="trash" />
    </div>
  );
}

function NotesView({ copy, title: _title, notes, semanticNotes, semanticLoading, notesPerPage, emptyText: _emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; semanticNotes: Note[]; semanticLoading: boolean; notesPerPage: number; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const { data: folders = [] } = useFoldersQuery();
  const [displayLimit, setDisplayLimit] = useState<number>(notesPerPage);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);

  const pinnedVisible = pinned.slice(0, displayLimit);
  const unpinnedVisible = unpinned.slice(0, Math.max(displayLimit - pinnedVisible.length, 0));
  const hasMore = displayLimit < notes.length;

  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w >= 1024) setColumns(4);
      else if (w >= 768) setColumns(3);
      else if (w >= 640) setColumns(2);
      else setColumns(1);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const unpinnedRows = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < unpinnedVisible.length; i += columns) {
      chunks.push(unpinnedVisible.slice(i, i + columns));
    }
    return chunks;
  }, [unpinnedVisible, columns]);

  const virtualizer = useWindowVirtualizer({
    count: unpinnedRows.length,
    estimateSize: () => (columns === 1 ? 160 : 200),
    overscan: 3,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { reorderNotes } = useNoteActions();
  const setNotesSort = useUiStore((state) => state.setNotesSort);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const isPinned = pinned.some((n) => n.id === active.id);
    const list = isPinned ? pinned : unpinned;

    const oldIndex = list.findIndex((n) => n.id === active.id);
    const newIndex = list.findIndex((n) => n.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const nextList = arrayMove(list, oldIndex, newIndex);
      setNotesSort("manual");
      void reorderNotes(nextList.map((n) => n.id));
    }
  }

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="content-scrollable space-y-5 p-3 sm:p-4">
        {pinnedVisible.length ? (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-accent">
              <Heart className="h-4 w-4" />
              {copy.shell.sections.pinned}
            </div>
            <SortableContext items={pinnedVisible.map((n) => n.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 sm:gap-[14px]">
                {pinnedVisible.map((note) => (
                  <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
                ))}
              </div>
            </SortableContext>
          </section>
        ) : null}

        {semanticLoading || semanticNotes.length ? (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-violet-600">
              <Sparkles className="h-4 w-4" />
              Похожие по смыслу
            </div>
            {semanticLoading ? (
              <div className="rounded-[1.4rem] border border-border bg-surface-strong px-4 py-3 text-sm text-foreground/58">
                Ищу семантические совпадения...
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 sm:gap-[14px]">
                {semanticNotes.map((note) => (
                  <NoteCard key={`semantic-${note.id}`} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {unpinnedVisible.length ? (
          <section>
            <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.notes}</div>
            <SortableContext items={unpinnedVisible.map((n) => n.id)} strategy={rectSortingStrategy}>
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const rowNotes = unpinnedRows[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="grid gap-3 sm:gap-[14px] pb-3 sm:pb-[14px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {rowNotes.map((note) => (
                          <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SortableContext>
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
    </DndContext>
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
        <div className="flex gap-4 relative">
          {[
            { id: "overview", label: "Сводка" },
            { id: "feedback", label: "Отзывы" },
            { id: "admins", label: "Администраторы" },
            { id: "diagnostics", label: "Диагностика" },
          ].map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`relative pb-3 text-sm font-bold transition-colors duration-200 active:scale-[0.98] ${
                  isActive ? "text-accent" : "text-foreground/50 hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="admin-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
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
                    {item.text || <span className="italic text-foreground/30">Без комментария</span>}
                  </p>
                  <div className="text-[10px] text-foreground/40 font-mono bg-background p-2 rounded-xl break-all">
                    UserAgent: {item.technical_data?.userAgent || "-"}<br/>
                    Language: {item.technical_data?.systemLanguage || "-"}<br/>
                    {item.technical_data?.diagnostics ? `Diagnostics: ${JSON.stringify(item.technical_data.diagnostics).substring(0, 100)}...` : ""}
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
