import { Heart, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { maskLockedPreview } from "@/features/lock-center/lib/lock-service";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import type { AppView } from "@/shared/store/ui-store";
import { useAuthStore } from "@/features/auth/model/auth-store";

import { getSheetAnchor, stripHtml, type SheetAnchor, type SheetName } from "./shared";

type NoteCardProps = {
  note: Note;
  folders: FolderEntity[];
  onOpenNote: (noteId: string) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor: SheetAnchor) => void;
  view: AppView;
};

export function NoteCard({ note, folders, onOpenNote, onOpenSheet, view }: NoteCardProps) {
  const [_folderPickerOpen, setFolderPickerOpen] = useState(false);
  const { toggleFavorite, togglePinned } = useNoteActions();
  const setCurrentNoteId = useNoteUiStore((state) => state.setCurrentNoteId);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isShared = (note.access && note.access.length > 0) || (note.ownerId && note.ownerId !== currentUserId && currentUserId !== "local-user" && currentUserId !== undefined);

  const previewText = note.lock?.hidden ? maskLockedPreview(note.id) : stripHtml(note.content);
  const reminderLabel = note.reminderAt
    ? new Date(note.reminderAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  const folder = folders.find((f) => f.id === note.folderId) ?? null;

  function _openReminderSheet(anchor: SheetAnchor) {
    setCurrentNoteId(note.id);
    onOpenSheet("reminder", anchor);
    setFolderPickerOpen(false);
  }

  return (
    <article className={`note-card relative overflow-visible rounded-[1.5rem] border bg-surface-strong p-4 text-left shadow-md shadow-violet-950/4 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5 border-border ${note.trashedAt ? "border-dashed border-rose-300" : "border-border"}`}>
      <div className="absolute right-3 top-3 z-10 flex items-start gap-1">
        {view === "trash" ? null : (
          <>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background ${note.pinned ? "text-accent" : ""}`} onClick={() => void togglePinned(note.id)} type="button">
              <PinGlyph active={note.pinned} />
            </button>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 backdrop-blur hover:bg-background ${note.favorite ? "text-rose-500" : "text-foreground/56"}`} onClick={() => void toggleFavorite(note.id)} type="button">
              <Heart className={`h-4 w-4 ${note.favorite ? "fill-current" : ""}`} />
            </button>
          </>
        )}

        <div className="relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background" onClick={(event) => { setCurrentNoteId(note.id); onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect())); }} type="button">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button className="block w-full text-left" onClick={() => onOpenNote(note.id)} type="button">
        <h3 className="pr-20 text-base font-black tracking-tight sm:text-lg mt-0">
          {note.title}
        </h3>
        <p className={`mt-2 line-clamp-3 text-sm leading-6 text-foreground/60 ${note.lock?.hidden ? "select-none" : ""}`}>
          {previewText}
        </p>
        {Boolean(note.reminderAt || note.lock || note.isArchived || folder || isShared) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-foreground/42">
            {note.reminderAt ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{reminderLabel}</span> : null}
            {note.lock ? <span className="rounded-full bg-foreground/8 px-2 py-1">🔒</span> : null}
            {note.isArchived ? <span className="rounded-full bg-foreground/8 px-2 py-1">Archive</span> : null}
            {folder ? <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">{folder.name}</span> : null}
            {isShared ? <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-400">👥 Collab</span> : null}
          </div>
        )}
        {note.userTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {note.userTags.slice(0, 5).map((tag) => (
              <span className="rounded-full border border-border px-3.5 py-1 text-xs font-semibold text-foreground/56" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}
        {note.aiStatus === "done" && note.aiRelevance > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-foreground/8">
              <div
                className="h-1 rounded-full bg-emerald-500"
                style={{ width: Math.round(note.aiRelevance * 100) + "%" }}
              />
            </div>
            <span className="text-[10px] font-bold text-foreground/36">{Math.round(note.aiRelevance * 100)}% релевантность</span>
          </div>
        )}
      </button>
    </article>
  );
}

function PinGlyph({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 ${active ? "fill-current" : ""}`} viewBox="0 0 24 24">
      <path d="M15 3a1 1 0 0 1 .7 1.7l-1.47 1.46 4.61 4.61a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42 0l-1.41-1.42-3.89 3.9v4.25a1 1 0 0 1-1.7.7l-1-1a1 1 0 0 1-.3-.7v-3.25l3.9-3.89-4.62-4.62L5.3 8.7A1 1 0 0 1 3.6 8l1.06-1.06a1 1 0 0 1 1.41 0L10.68 11l3.9-3.9-1.29-1.28A1 1 0 0 1 14 3h1Z" />
    </svg>
  );
}
