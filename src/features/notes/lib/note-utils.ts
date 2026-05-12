import type { MediaDescriptor, Note, NoteDraft, NotePage } from "@/entities/note";
import { stripHtml } from "@/shared/utils/string";
import { nowIso } from "@/shared/utils/date";
export { nowIso };

export const NOTE_PAGE_TITLE_MAX_LENGTH = 80;

type NotePatchOptions = {
  scheduleAnalysis?: boolean;
};

export type NotePagePatch = Partial<Pick<NotePage, "title" | "content" | "drawingDataUrl" | "drawingRevision">>;
export type NormalizedNotePatch = Partial<Note>;

export const ANALYSIS_FIELD_KEYS: Array<keyof Note> = ["title", "content", "pages", "userTags", "hiddenTags", "media", "folderId"];
const analysisFields = new Set<keyof Note>(ANALYSIS_FIELD_KEYS);

/**
 * Generate a plain UUID v4 suitable for database primary keys.
 * The database expects native UUIDs — string prefixes like "note_" cause
 * type mismatches when the column is uuid or when referencing across tables.
 */
export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }


  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function trimPageTitle(title: string) {
  return title.trim().slice(0, NOTE_PAGE_TITLE_MAX_LENGTH);
}

export function deriveTitle(draft: NoteDraft) {
  const explicitTitle = draft.title.trim();

  if (explicitTitle) {
    return explicitTitle;
  }

  const textTitle = stripHtml(draft.content).slice(0, 80);

  return textTitle || "Untitled note";
}

export function mergeContentFromPages(pages: NotePage[]) {
  return pages.map((page) => page.content.trim()).filter(Boolean).join("\n\n");
}

export function createInitialPage(content: string): NotePage {
  return {
    id: createId(),
    title: "Page 1",
    content,
    drawingDataUrl: null,
    drawingRevision: 0,
  };
}

export function createLocalNote(draft: NoteDraft, ownerId: string): Note {
  const createdAt = nowIso();
  const firstPage = createInitialPage(draft.content);

  return {
    id: createId(),
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

export function shouldScheduleAnalysis(patch: Partial<Note>, requested: boolean) {
  return requested && Object.keys(patch).some((field) => analysisFields.has(field as keyof Note));
}

export function normalizeNotePatch(patch: Partial<Note>, options: NotePatchOptions = {}): NormalizedNotePatch {
  const { scheduleAnalysis = true } = options;
  const analysisPending = shouldScheduleAnalysis(patch, scheduleAnalysis);

  return {
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
}

export function buildPageAddPatch(note: Note, title?: string) {
  const page: NotePage = {
    id: createId(),
    title: trimPageTitle(title ?? `Page ${note.pages.length + 1}`),
    content: "",
    drawingDataUrl: null,
    drawingRevision: 0,
  };
  const pages = [...note.pages, page];

  return {
    page,
    patch: {
      pages,
      content: mergeContentFromPages(pages),
    },
  };
}

export function buildPageUpdatePatch(note: Note, pageId: string, patch: NotePagePatch) {
  const pages = note.pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          ...patch,
          ...(patch.title === undefined ? null : { title: trimPageTitle(patch.title) }),
        }
      : page,
  );

  return {
    pages,
    ...(patch.content === undefined ? null : { content: mergeContentFromPages(pages) }),
  };
}

export function buildPageDeletePatch(note: Note, pageId: string) {
  if (note.pages.length <= 1) {
    return null;
  }

  const pages = note.pages.filter((page) => page.id !== pageId);

  return {
    pages,
    content: mergeContentFromPages(pages),
  };
}

export function buildMediaPatch(note: Note, media: MediaDescriptor) {
  return {
    media: [...note.media, media],
  };
}
