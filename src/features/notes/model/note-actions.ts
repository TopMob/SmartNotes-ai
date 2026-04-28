import type { MediaDescriptor, Note, NoteDraft, NotePage } from "@/entities/note";
import { notesRepository } from "@/features/notes/api/notes-repository";
import { scheduleAiAnalysis } from "@/services/ai/ai-queue";

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

export async function addNote(draft: NoteDraft, ownerId: string, optimisticNote = createLocalNote(draft, ownerId)) {

  useNotesStore.getState().addNote(optimisticNote);
  scheduleAiAnalysis(optimisticNote.id);

  try {
    const note = await notesRepository.create(optimisticNote);
    useNotesStore.getState().removeNote(optimisticNote.id);
    useNotesStore.getState().addNote(note);
    return note;
  } catch (error) {
    useNotesStore.getState().removeNote(optimisticNote.id);
    throw error;
  }
}

export async function patchNote(noteId: string, patch: Partial<Note>, options: NotePatchOptions = {}) {
  const { queueSync = true, scheduleAnalysis = true } = options;
  const currentNote = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!currentNote) {
    return;
  }

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
    try {
      const updatedNote = await notesRepository.patch(noteId, finalPatch);
      useNotesStore.getState().patchNote(noteId, updatedNote);
    } catch (error) {
      useNotesStore.getState().patchNote(noteId, currentNote);
      throw error;
    }
  }

  if (analysisPending) {
    scheduleAiAnalysis(noteId);
  }
}

export function trashNote(noteId: string) {
  return patchNote(noteId, { trashedAt: nowIso() }, { scheduleAnalysis: false });
}

export function restoreNote(noteId: string) {
  return patchNote(noteId, { trashedAt: null }, { scheduleAnalysis: false });
}

export async function permanentlyDeleteNote(noteId: string) {
  const currentNote = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!currentNote) {
    return;
  }

  useNotesStore.getState().removeNote(noteId);

  try {
    await notesRepository.remove(noteId);
  } catch (error) {
    useNotesStore.getState().addNote(currentNote);
    throw error;
  }
}

export function togglePinned(noteId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  return patchNote(noteId, { pinned: !note.pinned }, { scheduleAnalysis: false });
}

export function toggleFavorite(noteId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  return patchNote(noteId, { favorite: !note.favorite }, { scheduleAnalysis: false });
}

export function setArchived(noteId: string, isArchived: boolean) {
  return patchNote(noteId, { isArchived }, { scheduleAnalysis: false });
}

export function setReminder(noteId: string, reminderAt: string | null) {
  return patchNote(noteId, { reminderAt }, { scheduleAnalysis: false });
}

export function moveNoteToFolder(noteId: string, folderId: string | null) {
  return patchNote(noteId, { folderId }, { scheduleAnalysis: false });
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

  void patchNote(noteId, { pages, content: mergeContentFromPages(pages) });

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

  void patchNote(noteId, { pages, ...contentPatch });
}

export function deletePage(noteId: string, pageId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note || note.pages.length <= 1) {
    return false;
  }

  const pages = note.pages.filter((page) => page.id !== pageId);

  void patchNote(noteId, { pages, content: mergeContentFromPages(pages) });

  return true;
}

export function attachMedia(noteId: string, media: MediaDescriptor) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  void patchNote(noteId, { media: [...note.media, media] });
}
