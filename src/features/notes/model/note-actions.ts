import type { MediaDescriptor, Note, NoteDraft, NotePage } from "@/entities/note";
import { scheduleAiAnalysis } from "@/services/ai/ai-queue";
import { enqueueSyncItem } from "@/services/sync/sync-queue";

import { useNotesStore } from "./notes-store";

export const NOTE_PAGE_TITLE_MAX_LENGTH = 80;

type NotePatchOptions = {
  queueSync?: boolean;
  scheduleAnalysis?: boolean;
};

type NotePagePatch = Partial<Pick<NotePage, "title" | "content" | "drawingDataUrl" | "drawingRevision">>;

const analysisFields = new Set<keyof Note>(["title", "content", "pages", "userTags", "hiddenTags", "media"]);

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function trimPageTitle(title: string) {
  return title.trim().slice(0, NOTE_PAGE_TITLE_MAX_LENGTH);
}

function deriveTitle(draft: NoteDraft) {
  const explicitTitle = draft.title.trim();

  if (explicitTitle) {
    return explicitTitle;
  }

  const textTitle = draft.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  return textTitle || "Untitled note";
}

function mergeContentFromPages(pages: NotePage[]) {
  return pages.map((page) => page.content.trim()).filter(Boolean).join("\n\n");
}

function createInitialPage(content: string): NotePage {
  return {
    id: createId("page"),
    title: "Page 1",
    content,
    drawingDataUrl: null,
    drawingRevision: 0,
  };
}

function shouldScheduleAnalysis(patch: Partial<Note>, requested: boolean) {
  return requested && Object.keys(patch).some((field) => analysisFields.has(field as keyof Note));
}

function queueNoteSync(noteId: string, operation: "create" | "patch" | "delete", payload: unknown) {
  enqueueSyncItem({
    id: `${operation}_${noteId}_${Date.now().toString(36)}`,
    entity: "note",
    operation,
    payload,
  });
}

export function createLocalNote(draft: NoteDraft, ownerId: string): Note {
  const createdAt = nowIso();
  const firstPage = createInitialPage(draft.content);

  return {
    id: createId("note"),
    ownerId,
    folderId: draft.folderId,
    title: deriveTitle(draft),
    content: draft.content,
    pages: [firstPage],
    userTags: draft.userTags,
    hiddenTags: [],
    media: [],
    pinned: false,
    favorite: false,
    isArchived: false,
    reminderAt: null,
    lock: null,
    access: [],
    order: Date.now(),
    folderOrder: null,
    aiStatus: "pending",
    aiProcessed: false,
    analyzed: false,
    aiError: null,
    aiRelevance: 0,
    resurfacingClass: null,
    createdAt,
    updatedAt: createdAt,
    trashedAt: null,
  };
}

export function addNote(draft: NoteDraft, ownerId: string) {
  const note = createLocalNote(draft, ownerId);

  useNotesStore.getState().addNote(note);
  queueNoteSync(note.id, "create", { note });
  scheduleAiAnalysis(note.id);

  return note;
}

export function patchNote(noteId: string, patch: Partial<Note>, options: NotePatchOptions = {}) {
  const { queueSync = true, scheduleAnalysis = true } = options;
  const analysisPending = shouldScheduleAnalysis(patch, scheduleAnalysis);
  const finalPatch: Partial<Note> = {
    ...patch,
    updatedAt: nowIso(),
    ...(analysisPending
      ? {
          aiStatus: "pending" as const,
          aiProcessed: false,
          analyzed: false,
          aiError: null,
        }
      : null),
  };

  useNotesStore.getState().patchNote(noteId, finalPatch);

  if (queueSync) {
    queueNoteSync(noteId, "patch", { noteId, patch: finalPatch });
  }

  if (analysisPending) {
    scheduleAiAnalysis(noteId);
  }
}

export function trashNote(noteId: string) {
  patchNote(noteId, { trashedAt: nowIso() }, { scheduleAnalysis: false });
}

export function restoreNote(noteId: string) {
  patchNote(noteId, { trashedAt: null }, { scheduleAnalysis: false });
}

export function permanentlyDeleteNote(noteId: string) {
  useNotesStore.getState().removeNote(noteId);
  queueNoteSync(noteId, "delete", { noteId });
}

export function togglePinned(noteId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  patchNote(noteId, { pinned: !note.pinned }, { scheduleAnalysis: false });
}

export function toggleFavorite(noteId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  patchNote(noteId, { favorite: !note.favorite }, { scheduleAnalysis: false });
}

export function setArchived(noteId: string, isArchived: boolean) {
  patchNote(noteId, { isArchived }, { scheduleAnalysis: false });
}

export function setReminder(noteId: string, reminderAt: string | null) {
  patchNote(noteId, { reminderAt }, { scheduleAnalysis: false });
}

export function addPage(noteId: string, title?: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return null;
  }

  const page: NotePage = {
    id: createId("page"),
    title: trimPageTitle(title ?? `Page ${note.pages.length + 1}`),
    content: "",
    drawingDataUrl: null,
    drawingRevision: 0,
  };
  const pages = [...note.pages, page];

  patchNote(noteId, { pages, content: mergeContentFromPages(pages) });

  return page;
}

export function updatePage(noteId: string, pageId: string, patch: NotePagePatch) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  const pages = note.pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          ...patch,
          ...(patch.title === undefined ? null : { title: trimPageTitle(patch.title) }),
        }
      : page,
  );
  const contentPatch = patch.content === undefined ? null : { content: mergeContentFromPages(pages) };

  patchNote(noteId, { pages, ...contentPatch });
}

export function deletePage(noteId: string, pageId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note || note.pages.length <= 1) {
    return false;
  }

  const pages = note.pages.filter((page) => page.id !== pageId);

  patchNote(noteId, { pages, content: mergeContentFromPages(pages) });

  return true;
}

export function attachMedia(noteId: string, media: MediaDescriptor) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  patchNote(noteId, { media: [...note.media, media] });
}
