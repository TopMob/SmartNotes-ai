"use client";

import * as Y from "yjs";

import type { NotePage } from "@/entities/note";
import { NOTE_COLLAB_ROOT_KEY } from "@/features/editor-collab/lib/note-collab-constants";
import { createInitialPage, createId, trimPageTitle } from "@/features/notes/lib/note-utils";
import { setYText } from "@/features/editor-collab/model/yjs-note-doc";

import { useNoteCollabSession, useNoteCollabSnapshot } from "./use-note-collab-session";

function getPages(doc: Y.Doc) {
  const root = doc.getMap<unknown>(NOTE_COLLAB_ROOT_KEY);
  const pages = root.get("pages");

  if (!(pages instanceof Y.Array)) {
    throw new Error("Collaborative note pages array is missing.");
  }

  return pages as Y.Array<Y.Map<unknown>>;
}

function getPageContent(page: Y.Map<unknown>) {
  const content = page.get("content");

  if (!(content instanceof Y.Text)) {
    throw new Error("Collaborative note page content is missing.");
  }

  return content;
}

function createYPage(page: NotePage) {
  const yPage = new Y.Map<unknown>();
  const content = new Y.Text();

  if (page.content) {
    content.insert(0, page.content);
  }

  yPage.set("id", page.id);
  yPage.set("title", trimPageTitle(page.title) || "Untitled page");
  yPage.set("content", content);
  yPage.set("drawingDataUrl", page.drawingDataUrl);
  yPage.set("drawingRevision", page.drawingRevision);

  return yPage;
}

export function useNoteCollabPage(pageIndex: number) {
  const { doc } = useNoteCollabSession();
  const snapshot = useNoteCollabSnapshot();
  const page = snapshot.pages[pageIndex] ?? snapshot.pages[0] ?? createInitialPage("");

  function setPageContent(pageId: string, value: string) {
    const pages = getPages(doc);
    const pageIndex = pages.toArray().findIndex((candidate) => candidate.get("id") === pageId);

    if (pageIndex < 0) {
      return;
    }

    const yPage = pages.get(pageIndex);

    if (!yPage) {
      return;
    }

    const content = getPageContent(yPage);

    doc.transact(() => {
      setYText(content, value);
    }, "note-doc:set-page-content");
  }

  function setPageTitle(pageId: string, value: string) {
    const pages = getPages(doc);
    const yPage = pages.toArray().find((candidate) => candidate.get("id") === pageId);

    if (!yPage) {
      return;
    }

    doc.transact(() => {
      yPage.set("title", trimPageTitle(value) || "Untitled page");
    }, "note-doc:set-page-title");
  }

  function addPage(title?: string) {
    const pages = getPages(doc);
    const pageNumber = pages.length + 1;
    const nextPage: NotePage = {
      id: createId(),
      title: trimPageTitle(title ?? `Page ${pageNumber}`) || `Page ${pageNumber}`,
      content: "",
      drawingDataUrl: null,
      drawingRevision: 0,
    };

    doc.transact(() => {
      pages.push([createYPage(nextPage)]);
    }, "note-doc:add-page");

    return nextPage;
  }

  function removePage(pageId: string) {
    const pages = getPages(doc);
    const pagesArray = pages.toArray();

    if (pagesArray.length <= 1) {
      return false;
    }

    const index = pagesArray.findIndex((candidate) => candidate.get("id") === pageId);

    if (index < 0) {
      return false;
    }

    doc.transact(() => {
      pages.delete(index, 1);
    }, "note-doc:remove-page");

    return true;
  }

  function setDrawingData(pageId: string, drawingDataUrl: string | null, drawingRevision: number) {
    const pages = getPages(doc);
    const yPage = pages.toArray().find((candidate) => candidate.get("id") === pageId);

    if (!yPage) {
      return;
    }

    doc.transact(() => {
      yPage.set("drawingDataUrl", drawingDataUrl);
      yPage.set("drawingRevision", drawingRevision);
    }, "note-doc:set-drawing-data");
  }

  return {
    page,
    pages: snapshot.pages,
    pageCount: snapshot.pages.length,
    setPageContent,
    setPageTitle,
    addPage,
    removePage,
    setDrawingData,
  };
}
