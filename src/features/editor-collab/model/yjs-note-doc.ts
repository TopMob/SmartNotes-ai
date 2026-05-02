import * as Y from "yjs";

import type { Note, NotePage } from "@/entities/note";
import { NOTE_COLLAB_ROOT_KEY } from "@/features/editor-collab/lib/note-collab-constants";
import { createInitialPage, deriveTitle, mergeContentFromPages, trimPageTitle } from "@/features/notes/lib/note-utils";

const USER_TAGS_KEY = "userTags";
const PAGES_KEY = "pages";
const PAGE_CONTENT_KEY = "content";
const SCHEMA_VERSION = 1;

type YNotePage = Y.Map<unknown>;

export type YNoteDocSnapshot = {
  noteId: string;
  title: string;
  folderId: string | null;
  userTags: string[];
  pages: NotePage[];
  content: string;
};

function createYText(value = "") {
  const text = new Y.Text();

  if (value) {
    text.insert(0, value);
  }

  return text;
}

function setYText(target: Y.Text, value: string) {
  if (target.toString() === value) {
    return;
  }

  if (target.length > 0) {
    target.delete(0, target.length);
  }

  if (value) {
    target.insert(0, value);
  }
}

function getRoot(doc: Y.Doc) {
  return doc.getMap<unknown>(NOTE_COLLAB_ROOT_KEY);
}

function getOrCreateTags(root: Y.Map<unknown>) {
  const current = root.get(USER_TAGS_KEY);

  if (current instanceof Y.Array) {
    return current as Y.Array<string>;
  }

  const tags = new Y.Array<string>();
  root.set(USER_TAGS_KEY, tags);
  return tags;
}

function getOrCreatePages(root: Y.Map<unknown>) {
  const current = root.get(PAGES_KEY);

  if (current instanceof Y.Array) {
    return current as Y.Array<YNotePage>;
  }

  const pages = new Y.Array<YNotePage>();
  root.set(PAGES_KEY, pages);
  return pages;
}

function getOrCreatePageContent(page: YNotePage) {
  const current = page.get(PAGE_CONTENT_KEY);

  if (current instanceof Y.Text) {
    return current;
  }

  const content = createYText();
  page.set(PAGE_CONTENT_KEY, content);
  return content;
}

function createYPage(page: NotePage) {
  const yPage = new Y.Map<unknown>();
  yPage.set("id", page.id);
  yPage.set("title", trimPageTitle(page.title));
  yPage.set(PAGE_CONTENT_KEY, createYText(page.content));
  yPage.set("drawingDataUrl", page.drawingDataUrl);
  yPage.set("drawingRevision", page.drawingRevision);
  return yPage;
}

function normalizePages(note: Pick<Note, "content" | "pages">) {
  if (note.pages.length > 0) {
    return note.pages;
  }

  return [createInitialPage(note.content)];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ensureYNoteDoc(doc: Y.Doc) {
  const root = getRoot(doc);

  doc.transact(() => {
    if (root.get("schemaVersion") !== SCHEMA_VERSION) {
      root.set("schemaVersion", SCHEMA_VERSION);
    }

    if (!(root.get("title") instanceof Y.Text)) {
      root.set("title", createYText());
    }

    if (!root.has("folderId")) {
      root.set("folderId", null);
    }

    getOrCreateTags(root);
    const pages = getOrCreatePages(root);

    pages.forEach((page) => {
      getOrCreatePageContent(page);

      if (!page.has("drawingDataUrl")) {
        page.set("drawingDataUrl", null);
      }

      if (!page.has("drawingRevision")) {
        page.set("drawingRevision", 0);
      }
    });
  }, "note-doc:ensure-shape");

  return root;
}

export function applyNoteToYDoc(doc: Y.Doc, note: Pick<Note, "id" | "title" | "folderId" | "userTags" | "content" | "pages">) {
  const root = ensureYNoteDoc(doc);

  doc.transact(() => {
    root.set("noteId", note.id);
    setYText(root.get("title") as Y.Text, note.title);
    root.set("folderId", note.folderId);

    const tags = getOrCreateTags(root);
    tags.delete(0, tags.length);
    if (note.userTags.length > 0) {
      tags.insert(0, note.userTags);
    }

    const pages = getOrCreatePages(root);
    const normalizedPages = normalizePages(note);
    pages.delete(0, pages.length);
    pages.insert(0, normalizedPages.map(createYPage));
  }, "note-doc:hydrate");

  return doc;
}

export function createYDocFromNote(note: Pick<Note, "id" | "title" | "folderId" | "userTags" | "content" | "pages">) {
  const doc = new Y.Doc();
  return applyNoteToYDoc(doc, note);
}

export function createEmptyYNoteDoc() {
  const doc = new Y.Doc();
  ensureYNoteDoc(doc);
  return doc;
}

export function readNoteSnapshotFromYDoc(doc: Y.Doc): YNoteDocSnapshot {
  const root = ensureYNoteDoc(doc);
  const pages = getOrCreatePages(root).toArray().map((page) => ({
    id: readString(page.get("id")),
    title: trimPageTitle(readString(page.get("title"), "Untitled page")) || "Untitled page",
    content: getOrCreatePageContent(page).toString(),
    drawingDataUrl: readNullableString(page.get("drawingDataUrl")),
    drawingRevision: readNumber(page.get("drawingRevision"), 0),
  } satisfies NotePage));

  return {
    noteId: readString(root.get("noteId")),
    title: (root.get("title") as Y.Text).toString(),
    folderId: readNullableString(root.get("folderId")),
    userTags: getOrCreateTags(root).toArray().map((tag) => String(tag)).filter(Boolean),
    pages,
    content: mergeContentFromPages(pages),
  };
}

export function buildDurableNotePatchFromYDoc(doc: Y.Doc) {
  const snapshot = readNoteSnapshotFromYDoc(doc);

  const rawTitle = snapshot.title.trim();
  const isUntitled = !rawTitle || rawTitle === "Untitled note" || rawTitle === "Untitled Note";

  const title = isUntitled
    ? deriveTitle({ title: "", content: snapshot.content, folderId: snapshot.folderId, userTags: snapshot.userTags })
    : rawTitle;

  return {
    title,
    folderId: snapshot.folderId,
    userTags: snapshot.userTags,
    pages: snapshot.pages,
    content: snapshot.content,
  } satisfies Pick<Note, "title" | "folderId" | "userTags" | "pages" | "content">;
}

export function getYDocPageCount(doc: Y.Doc) {
  return getOrCreatePages(ensureYNoteDoc(doc)).length;
}
