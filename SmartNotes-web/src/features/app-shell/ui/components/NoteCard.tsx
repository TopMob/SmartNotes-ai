import { Heart, MoreHorizontal, Pin, Lock, Users } from "lucide-react";
import { useState, memo } from "react";
import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { maskLockedPreview } from "@/features/lock-center/lib/lock-service";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useLockStore } from "@/features/lock-center/model/lock-store";
import type { AppView } from "@/shared/store/ui-store";
import { useAuthStore } from "@/features/auth/model/auth-store";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getSheetAnchor, stripHtml, type SheetAnchor, type SheetName } from "./shared";

type NoteCardProps = {
  note: Note;
  folders: FolderEntity[];
  onOpenNote: (noteId: string) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor: SheetAnchor) => void;
  view: AppView;
};

export const NoteCard = memo(function NoteCard({ note, folders, onOpenNote, onOpenSheet, view }: NoteCardProps) {
  const [_folderPickerOpen, setFolderPickerOpen] = useState(false);
  const { toggleFavorite, togglePinned } = useNoteActions();
  const setCurrentNoteId = useNoteUiStore((state) => state.setCurrentNoteId);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isShared = (note.access && note.access.length > 0) || (note.ownerId && note.ownerId !== currentUserId && currentUserId !== "local-user" && currentUserId !== undefined);
  const isUnlocked = useLockStore((state) => state.unlockedNotes.has(note.id));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  const previewText = note.lock && !isUnlocked ? maskLockedPreview(note.id) : stripHtml(note.content);
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
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`note-card relative overflow-visible rounded-[1.5rem] border bg-surface-strong p-4 text-left shadow-md shadow-violet-950/4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-violet-950/8 sm:p-5 border-border flex flex-col h-full min-h-[200px] ${note.trashedAt ? "border-dashed border-rose-300" : "border-border"}`}
    >
      {/* Top right action buttons. Positioned at z-20 relative so they render on top of the card's clickable pseudo-overlay. */}
      <div className="absolute right-3 top-3 z-20 flex items-start gap-1">
        {view === "trash" ? null : (
          <>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 backdrop-blur hover:bg-background ${note.pinned ? "text-accent" : "text-foreground/56"}`} onClick={(e) => { e.stopPropagation(); void togglePinned(note.id); }} type="button">
              <Pin className={`h-4 w-4 ${note.pinned ? "fill-current" : ""}`} />
            </button>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 backdrop-blur hover:bg-background ${note.favorite ? "text-rose-500" : "text-foreground/56"}`} onClick={(e) => { e.stopPropagation(); void toggleFavorite(note.id); }} type="button">
              <Heart className={`h-4 w-4 ${note.favorite ? "fill-current" : ""}`} />
            </button>
          </>
        )}

        <div className="relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background" onClick={(event) => {
            event.stopPropagation();
            if (note.lock && !isUnlocked) {
              onOpenNote(note.id);
            } else {
              setCurrentNoteId(note.id);
              onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()));
            }
          }} type="button">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main card trigger button. Stretched using the pseudo-element 'before' overlay at z-10.
          This handles standard button semantics, keyboard focus/triggering, and makes the ENTIRE card clickable. */}
      <button 
        className="flex flex-col flex-1 h-full w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 before:absolute before:inset-0 before:rounded-[1.5rem] before:z-10" 
        onClick={() => onOpenNote(note.id)} 
        type="button"
      >
        <div className="flex-1 w-full">
          <h3 className="pr-20 text-base font-black tracking-tight sm:text-lg mt-0 truncate" title={note.title}>
            {note.title}
          </h3>
          <p className={`mt-2 line-clamp-3 text-sm leading-6 text-foreground/60 ${note.lock?.hidden && !isUnlocked ? "select-none" : ""}`}>
            {previewText}
          </p>
        </div>
        
        <div className="relative z-20 pointer-events-none mt-auto pt-3.5 w-full">
          {Boolean(note.reminderAt || note.lock || note.isArchived || folder || isShared) && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">
              {note.reminderAt ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{reminderLabel}</span> : null}
              {note.lock ? <span className="rounded-full bg-foreground/8 px-2 py-1 flex items-center gap-1.5"><Lock className="h-3 w-3" /> Lock</span> : null}
              {note.isArchived ? <span className="rounded-full bg-foreground/8 px-2 py-1">Archive</span> : null}
              {folder ? <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">{folder.name}</span> : null}
              {isShared ? <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-400 flex items-center gap-1.5"><Users className="h-3 w-3" /> Collab</span> : null}
            </div>
          )}
          {(!note.lock || isUnlocked) && note.userTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {note.userTags.slice(0, 5).map((tag) => (
                <span className="rounded-full border border-border px-3.5 py-1 text-xs font-semibold text-foreground/56" key={tag}>
                  #{tag.replace(/^#+/, "")}
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
          {note.aiStatus === "analyzing" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
              <span>ИИ анализирует...</span>
            </div>
          )}
          {note.aiStatus === "pending" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground/42">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/36" />
              <span>ИИ в очереди...</span>
            </div>
          )}
        </div>
      </button>
    </article>

  );
});


