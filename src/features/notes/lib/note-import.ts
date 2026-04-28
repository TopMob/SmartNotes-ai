import type { Note, NoteDraft, NotePage } from "@/entities/note";

import { createLocalNote, deriveTitle, trimPageTitle } from "./note-utils";

type ImportedNotePayload = Partial<Note> & Partial<NoteDraft> & {
  pages?: Array<Partial<NotePage>>;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseImportedNoteFile(text: string, ownerId: string) {
  const parsed = JSON.parse(text) as ImportedNotePayload;
  const title = readString(parsed.title);
  const content = readString(parsed.content);
  const userTags = readStringArray(parsed.userTags);
  const folderId = typeof parsed.folderId === "string" ? parsed.folderId : null;
  const draft: NoteDraft = {
    title,
    content,
    folderId,
    userTags,
  };
  const note = createLocalNote(draft, ownerId);

  if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
    note.pages = parsed.pages.map((page, index) => ({
      id: readString(page.id, `imported_page_${index + 1}`),
      title: trimPageTitle(readString(page.title, `Page ${index + 1}`)) || `Page ${index + 1}`,
      content: readString(page.content),
      drawingDataUrl: typeof page.drawingDataUrl === "string" ? page.drawingDataUrl : null,
      drawingRevision: typeof page.drawingRevision === "number" ? page.drawingRevision : 0,
    }));
    note.content = note.pages.map((page) => page.content.trim()).filter(Boolean).join("\n\n");
  } else {
    note.title = deriveTitle(draft);
  }

  note.title = title || note.title;
  note.userTags = userTags;

  return note;
}
