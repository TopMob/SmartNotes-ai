"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";

import { NOTE_COLLAB_INDEXEDDB_PREFIX } from "./note-collab-constants";

export function createNoteIndexeddbProvider(noteId: string, doc: Y.Doc) {
  return new IndexeddbPersistence(`${NOTE_COLLAB_INDEXEDDB_PREFIX}:${noteId}`, doc);
}
