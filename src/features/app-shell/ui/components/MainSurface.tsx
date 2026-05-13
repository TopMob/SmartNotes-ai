import { Brain, Folder, Heart, RotateCcw, Shield, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { selectPinnedGroups } from "@/features/notes/model/note-selectors";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { listPendingAiAnalysis } from "@/services/ai/ai-queue";
import { listCollabDiagnostics, getMediaDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { listSyncQueue } from "@/services/sync/sync-queue";
import { getUiCopy } from "@/shared/lib/i18n";
import type { AppView } from "@/shared/store/ui-store";

import { NoteCard } from "./NoteCard";
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
};

export function MainSurface({ copy, view, folders, hiddenFolders, trashedFolders, notes, activeFolder, folderViewMode, notesPerPage, onOpenFolder, onOpenNote, onOpenSheet }: MainSurfaceProps) {
  if (view === "admin_tools") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><AdminToolsView notes={notes} onOpenSheet={onOpenSheet} /></section>;
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[14px] p-4 sm:p-5">
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
    <div className="content-scrollable space-y-6 p-4 sm:p-5">
      <div className="flex justify-end">
        <button className="rounded-2xl border border-border bg-surface-strong px-4 py-2 text-sm font-black text-rose-500" onClick={() => void clearTrash()} type="button">{copy.shell.actions.clear}</button>
      </div>
      {trashedFolders.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.deletedFolders}</div>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {trashedFolders.map((folder) => (
              <div className="rounded-[1.2rem] border border-dashed border-rose-300 bg-surface-strong p-5" key={folder.id}>
                <h3 className="text-base font-black tracking-tight">{folder.name}</h3>
                <p className="mt-2 text-sm text-foreground/56">{folder.description}</p>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-accent" onClick={() => void restoreFolder(folder.id)} type="button">{copy.shell.actions.restore}</button>
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-rose-500" onClick={() => void permanentlyDeleteFolder(folder.id)} type="button">{copy.shell.actions.delete}</button>
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

function NotesView({ copy, title: _title, notes, notesPerPage, emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const { data: folders = [] } = useFoldersQuery();
  const [displayLimit, setDisplayLimit] = useState<number>(notesPerPage);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);
  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);

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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[14px]">
            {pinnedVisible.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
            ))}
          </div>
        </section>
      ) : null}

      {unpinnedVisible.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.notes}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[14px]">
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
            {(copy.shell.actions as any)?.loadMore || "Показать еще"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AdminToolsView({ notes, onOpenSheet }: { notes: Note[]; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
  const pending = notes.filter((note) => note.aiStatus === "pending").length;
  const failed = notes.filter((note) => note.aiStatus === "error").length;
  const analyzing = notes.filter((note) => note.aiStatus === "analyzing").length;
  const queued = listPendingAiAnalysis().length;
  const syncBacklog = listSyncQueue().length;
  const collabSessions = listCollabDiagnostics().length;
  const mediaDiagnostic = getMediaDiagnostic();

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { title: "AI pending / queued", value: `${pending} / ${queued}`, icon: Brain },
        { title: "AI analyzing / errors", value: `${analyzing} / ${failed}`, icon: Shield },
        { title: "Sync backlog", value: syncBacklog, icon: RotateCcw },
        { title: "Collab sessions", value: collabSessions, icon: Sparkles },
        { title: "Media mode", value: mediaDiagnostic.degraded ? "degraded" : mediaDiagnostic.provider, icon: Folder },
      ].map((card) => {
        const Icon = card.icon;

        return (
          <button className="rounded-[1.6rem] border border-border bg-surface-strong p-5 text-left shadow-lg shadow-violet-950/4" key={card.title} onClick={() => onOpenSheet("admin-tools")} type="button">
            <div className="flex items-center gap-2 text-accent"><Icon className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">Admin</span></div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">{card.value}</h2>
            <p className="mt-2 text-sm text-foreground/56">{card.title}</p>
          </button>
        );
      })}
    </div>
  );
}
