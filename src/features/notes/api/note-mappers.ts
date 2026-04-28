import type { MediaDescriptor, Note, NoteAccess, NoteDraft, NoteLock, NotePage } from "@/entities/note";
import type { Database, Json } from "@/shared/api/supabase/types";

type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];

function asPages(value: Json): NotePage[] {
  return Array.isArray(value) ? (value as NotePage[]) : [];
}

function asMedia(value: Json): MediaDescriptor[] {
  return Array.isArray(value) ? (value as MediaDescriptor[]) : [];
}

function asAccess(value: Json): NoteAccess[] {
  return Array.isArray(value) ? (value as NoteAccess[]) : [];
}

function asLock(value: Json | null): NoteLock | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as NoteLock) : null;
}

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    title: row.title,
    content: row.content,
    pages: asPages(row.pages),
    userTags: row.user_tags,
    hiddenTags: row.hidden_tags,
    media: asMedia(row.media),
    pinned: row.pinned,
    favorite: row.favorite,
    isArchived: row.is_archived,
    reminderAt: row.reminder_at,
    lock: asLock(row.lock),
    access: asAccess(row.access),
    order: row.manual_order,
    folderOrder: row.folder_order,
    aiStatus: row.ai_status,
    aiProcessed: row.ai_processed,
    analyzed: row.analyzed,
    aiError: row.ai_error,
    aiRelevance: row.ai_relevance,
    resurfacingClass: row.resurfacing_class,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trashedAt: row.trashed_at,
  };
}

export function mapNoteDraftToInsert(note: Note): NoteInsert {
  return {
    id: note.id,
    owner_id: note.ownerId,
    folder_id: note.folderId,
    title: note.title,
    content: note.content,
    pages: note.pages as Json,
    user_tags: note.userTags,
    hidden_tags: note.hiddenTags,
    media: note.media as Json,
    pinned: note.pinned,
    favorite: note.favorite,
    is_archived: note.isArchived,
    reminder_at: note.reminderAt,
    lock: note.lock as Json | null,
    access: note.access as Json,
    manual_order: note.order,
    folder_order: note.folderOrder,
    ai_status: note.aiStatus,
    ai_processed: note.aiProcessed,
    analyzed: note.analyzed,
    ai_error: note.aiError,
    ai_relevance: note.aiRelevance,
    resurfacing_class: note.resurfacingClass,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    trashed_at: note.trashedAt,
  };
}

export function mapNotePatchToUpdate(patch: Partial<Note>): NoteUpdate {
  return {
    owner_id: patch.ownerId,
    folder_id: patch.folderId,
    title: patch.title,
    content: patch.content,
    pages: patch.pages as Json | undefined,
    user_tags: patch.userTags,
    hidden_tags: patch.hiddenTags,
    media: patch.media as Json | undefined,
    pinned: patch.pinned,
    favorite: patch.favorite,
    is_archived: patch.isArchived,
    reminder_at: patch.reminderAt,
    lock: patch.lock as Json | null | undefined,
    access: patch.access as Json | undefined,
    manual_order: patch.order,
    folder_order: patch.folderOrder,
    ai_status: patch.aiStatus,
    ai_processed: patch.aiProcessed,
    analyzed: patch.analyzed,
    ai_error: patch.aiError,
    ai_relevance: patch.aiRelevance,
    resurfacing_class: patch.resurfacingClass,
    created_at: patch.createdAt,
    updated_at: patch.updatedAt,
    trashed_at: patch.trashedAt,
  };
}

export function deriveTitleFromDraft(draft: NoteDraft) {
  const explicitTitle = draft.title.trim();

  if (explicitTitle) {
    return explicitTitle;
  }

  const textTitle = draft.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  return textTitle || "Untitled note";
}
