import { Heart, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { maskLockedPreview } from "@/features/lock-center/lib/lock-service";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import type { AppView } from "@/shared/store/ui-store";

import { getSheetAnchor, stripHtml, type SheetAnchor, type SheetName } from "./shared";

type NoteCardProps = {
  note: Note;
  folders: FolderEntity[];
  onOpenNote: (noteId: string) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor: SheetAnchor) => void;
  view: AppView;
};

export function NoteCard({ note, folders, onOpenNote, onOpenSheet, view }: NoteCardProps) {
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const { toggleFavorite, togglePinned } = useNoteActions();
  const setCurrentNoteId = useNoteUiStore((state) => state.setCurrentNoteId);

  const previewText = note.lock?.hidden ? maskLockedPreview(note.id) : stripHtml(note.content);
  const reminderLabel = note.reminderAt
    ? new Date(note.reminderAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  const aiBadgeTone = note.aiStatus === "error" ? "text-rose-500 bg-rose-500/10" : note.aiStatus === "pending" ? "text-amber-600 bg-amber-500/10" : note.aiStatus === "analyzing" ? "text-sky-600 bg-sky-500/10" : "text-emerald-600 bg-emerald-500/10";
  function openReminderSheet(anchor: SheetAnchor) {
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
        <div className="mt-1 flex min-h-7 flex-wrap items-center gap-2 pr-20 text-[12px] font-black uppercase tracking-[0.18em] text-foreground/42">
          {note.reminderAt ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{reminderLabel}</span> : null}
          {note.lock ? <span className="rounded-full bg-foreground/8 px-2 py-1">Locked</span> : null}
          {note.isArchived ? <span className="rounded-full bg-foreground/8 px-2 py-1">Archive</span> : null}
          <span className={`rounded-full px-2 py-1 ${aiBadgeTone}`}>AI: {note.aiStatus}</span>
        </div>
        <h3 className="mt-3 pr-20 text-base font-black tracking-tight sm:text-lg">{note.title}</h3>
        <p className={`mt-2 line-clamp-3 text-sm leading-6 text-foreground/60 ${note.lock?.hidden ? "select-none" : ""}`}>{previewText}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {note.userTags.map((tag) => (
            <span className="rounded-full border border-border px-3.5 py-1 text-xs font-semibold text-foreground/56" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
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
