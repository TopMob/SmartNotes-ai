"use client";

import * as Y from "yjs";

import { useNoteCollabSession, useNoteCollabSnapshot } from "./use-note-collab-session";

function getRoot(doc: Y.Doc) {
  return doc.getMap<unknown>("note");
}

function getTitle(doc: Y.Doc) {
  const title = getRoot(doc).get("title");

  if (!(title instanceof Y.Text)) {
    throw new Error("Collaborative note title is missing.");
  }

  return title;
}

function getUserTags(doc: Y.Doc) {
  const tags = getRoot(doc).get("userTags");

  if (!(tags instanceof Y.Array)) {
    throw new Error("Collaborative note tags array is missing.");
  }

  return tags as Y.Array<string>;
}

export function useNoteTitleTags() {
  const { doc } = useNoteCollabSession();
  const snapshot = useNoteCollabSnapshot();

  function setTitle(value: string) {
    const title = getTitle(doc);

    doc.transact(() => {
      if (title.length > 0) {
        title.delete(0, title.length);
      }

      if (value) {
        title.insert(0, value);
      }
    }, "note-doc:set-title");
  }

  function setUserTags(value: string[]) {
    const userTags = getUserTags(doc);

    doc.transact(() => {
      userTags.delete(0, userTags.length);

      if (value.length > 0) {
        userTags.insert(0, value);
      }
    }, "note-doc:set-user-tags");
  }

  return {
    title: snapshot.title,
    userTags: snapshot.userTags,
    setTitle,
    setUserTags,
  };
}
