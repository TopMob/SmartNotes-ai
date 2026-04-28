import type { Note, NoteDraft, NotePage } from "@/entities/note";

import { createId, createLocalNote, deriveTitle, trimPageTitle } from "./note-utils";

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
      id: createId("page"),
      title: trimPageTitle(readString(page.title, `Page ${index + 1}`)) || `Page ${index + 1}`,
      content: readString(page.content),
      drawingDataUrl: typeof page.drawingDataUrl === "string" ? page.drawingDataUrl : null,
      drawingRevision: typeof page.drawingRevision === "number" ? page.drawingRevision : 0,
    }));
    note.content = note.pages.map((page) => page.content.trim()).filter(Boolean).join("\n\n");
    note.title = trimPageTitle(title || readString(parsed.pages[0]?.title)) || deriveTitle({ title, content: note.content, folderId, userTags });
  } else {
    note.title = deriveTitle(draft);
  }

  note.title = title || note.title;
  note.userTags = userTags;

  return note;
}

export function parseImportedNotesFile(text: string, ownerId: string) {
  const parsed = JSON.parse(text) as unknown;
  const items = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && "notes" in parsed && Array.isArray((parsed as { notes: unknown }).notes)
      ? (parsed as { notes: unknown[] }).notes
      : [parsed];
  const seenTitles = new Map<string, number>();

  return items.map((item) => {
    const note = parseImportedNoteFile(JSON.stringify(item), ownerId);
    const baseTitle = note.title.trim() || deriveTitle({ title: note.title, content: note.content, folderId: note.folderId, userTags: note.userTags });
    const count = seenTitles.get(baseTitle) ?? 0;
    seenTitles.set(baseTitle, count + 1);

    return {
      ...note,
      id: createId("note"),
      title: count === 0 ? baseTitle : `${baseTitle} (${count + 1})`,
      pages: note.pages.map((page) => ({ ...page, id: createId("page") })),
    };
  });
}
