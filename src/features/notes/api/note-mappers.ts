import type { Note, NoteDraft, NoteLock } from "@/entities/note";
import type { Database } from "@/shared/api/supabase/types";
import { stripHtml } from "@/shared/utils/string";

export type NoteRow = Database["public"]["Tables"]["notes"]["Row"] & {
  note_pages?: Database["public"]["Tables"]["note_pages"]["Row"][];
  note_access?: (Database["public"]["Tables"]["note_access"]["Row"] & {
    profiles?: Database["public"]["Tables"]["profiles"]["Row"] | null;
  })[];
};
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];

function asLock(row: NoteRow): NoteLock | null {
  if (row.lock_version === null || row.lock_hash === null) {
    return null;
  }

  return {
    v: row.lock_version,
    hash: row.lock_hash,
    salt: row.lock_salt ?? undefined,
    hidden: row.lock_hidden,
  };
}

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    title: row.title,
    content: row.content,
    pages: (row.note_pages || [])
      .sort((a, b) => a.page_index - b.page_index)
      .map((p) => ({
        id: p.client_page_id || p.id,
        title: p.title,
        content: p.content,
        drawingDataUrl: p.drawing_data_url,
        drawingRevision: p.drawing_revision,
      })),
    userTags: row.user_tags,
    hiddenTags: row.hidden_tags,
    media: [],
    pinned: row.pinned,
    favorite: row.favorite,
    isArchived: row.is_archived,
    reminderAt: row.reminder_at,
    lock: asLock(row),
    access: (row.note_access || []).map((acc) => ({
      userId: acc.user_id,
      role: acc.role,
      status: "accepted" as const,
      email: acc.profiles?.email || null,
      displayName: acc.profiles?.display_name || null,
      photoURL: acc.profiles?.avatar_url || null,
    })),
    order: row.manual_order,
    folderOrder: row.folder_order,
    aiStatus: row.ai_status,
    aiProcessed: row.ai_processed,
    analyzed: row.analyzed,
    aiError: row.ai_error,
    aiRelevance: row.ai_relevance,
    resurfacingClass: row.resurfacing_class,
    metadata: row.metadata as Record<string, unknown> | null,
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
    user_tags: note.userTags,
    hidden_tags: note.hiddenTags,
    pinned: note.pinned,
    favorite: note.favorite,
    is_archived: note.isArchived,
    reminder_at: note.reminderAt,
    lock_version: note.lock?.v ?? null,
    lock_hash: note.lock?.hash ?? null,
    lock_salt: note.lock?.salt ?? null,
    lock_hidden: note.lock?.hidden ?? false,
    manual_order: note.order,
    folder_order: note.folderOrder,
    ai_status: note.aiStatus,
    ai_processed: note.aiProcessed,
    analyzed: note.analyzed,
    ai_error: note.aiError,
    ai_relevance: note.aiRelevance,
    resurfacing_class: note.resurfacingClass,
    metadata: note.metadata as Database["public"]["Tables"]["notes"]["Insert"]["metadata"],
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    trashed_at: note.trashedAt,
  };
}

function cleanUndefined<T extends object>(obj: T): T {
  const res = {} as any;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      res[key] = obj[key];
    }
  }
  return res;
}

export function mapNotePatchToUpdate(patch: Partial<Note>): NoteUpdate {
  const lockFields =
    patch.lock === undefined
      ? {}
      : {
          lock_version: patch.lock?.v ?? null,
          lock_hash: patch.lock?.hash ?? null,
          lock_salt: patch.lock?.salt ?? null,
          lock_hidden: patch.lock?.hidden ?? false,
        };

  const raw = {
    owner_id: patch.ownerId,
    folder_id: patch.folderId,
    title: patch.title,
    content: patch.content,
    user_tags: patch.userTags,
    hidden_tags: patch.hiddenTags,
    pinned: patch.pinned,
    favorite: patch.favorite,
    is_archived: patch.isArchived,
    reminder_at: patch.reminderAt,
    ...lockFields,
    manual_order: patch.order,
    folder_order: patch.folderOrder,
    ai_status: patch.aiStatus,
    ai_processed: patch.aiProcessed,
    analyzed: patch.analyzed,
    ai_error: patch.aiError,
    ai_relevance: patch.aiRelevance,
    resurfacing_class: patch.resurfacingClass,
    metadata: patch.metadata as Database["public"]["Tables"]["notes"]["Update"]["metadata"],
    created_at: patch.createdAt,
    updated_at: patch.updatedAt,
    trashed_at: patch.trashedAt,
  };

  return cleanUndefined(raw);
}

export function deriveTitleFromDraft(draft: NoteDraft) {
  const explicitTitle = draft.title.trim();

  if (explicitTitle) {
    return explicitTitle;
  }

  const cleanText = stripHtml(draft.content)
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    return "Untitled note";
  }

  const words = cleanText.split(" ");
  const maxWords = 6;
  if (words.length <= maxWords) {
    return cleanText;
  }

  return words.slice(0, maxWords).join(" ") + "...";
}
