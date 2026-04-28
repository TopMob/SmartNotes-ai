"use client";

import * as Y from "yjs";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Note } from "@/entities/note";
import { applyNoteToYDoc, createYDocFromNote, readNoteSnapshotFromYDoc, type YNoteDocSnapshot } from "@/features/editor-collab/model/yjs-note-doc";

type NoteCollabStatus = "hydrating" | "ready" | "error";

type NoteCollabSessionValue = {
  doc: Y.Doc;
  noteId: string;
  status: NoteCollabStatus;
  error: Error | null;
  hydratedFromQuery: boolean;
};

const NoteCollabSessionContext = createContext<NoteCollabSessionValue | null>(null);

type NoteCollabProviderProps = {
  note: Pick<Note, "id" | "title" | "folderId" | "userTags" | "content" | "pages">;
  children: ReactNode;
};

export function NoteCollabSessionProvider({ note, children }: NoteCollabProviderProps) {
  const sessionRef = useRef<{ noteId: string; doc: Y.Doc } | null>(null);
  const [status, setStatus] = useState<NoteCollabStatus>("hydrating");
  const [error, setError] = useState<Error | null>(null);
  const [hydratedFromQuery, setHydratedFromQuery] = useState(false);

  if (!sessionRef.current || sessionRef.current.noteId !== note.id) {
    sessionRef.current?.doc.destroy();
    sessionRef.current = {
      noteId: note.id,
      doc: createYDocFromNote(note),
    };
  }

  useEffect(() => {
    const session = sessionRef.current;

    if (!session || session.noteId !== note.id) {
      return;
    }

    try {
      applyNoteToYDoc(session.doc, note);
      setHydratedFromQuery(true);
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause : new Error("Failed to hydrate collaborative note session."));
    }
  }, [note]);

  useEffect(() => () => {
    sessionRef.current?.doc.destroy();
    sessionRef.current = null;
  }, []);

  const value = useMemo<NoteCollabSessionValue>(() => {
    const session = sessionRef.current;

    if (!session) {
      throw new Error("Collaborative note session is unavailable.");
    }

    return {
      doc: session.doc,
      noteId: session.noteId,
      status,
      error,
      hydratedFromQuery,
    };
  }, [error, hydratedFromQuery, status]);

  return <NoteCollabSessionContext.Provider value={value}>{children}</NoteCollabSessionContext.Provider>;
}

export function useNoteCollabSession() {
  const value = useContext(NoteCollabSessionContext);

  if (!value) {
    throw new Error("useNoteCollabSession must be used within NoteCollabSessionProvider.");
  }

  return value;
}

export function useNoteCollabSnapshot(): YNoteDocSnapshot {
  const { doc } = useNoteCollabSession();
  const [snapshot, setSnapshot] = useState(() => readNoteSnapshotFromYDoc(doc));

  useEffect(() => {
    setSnapshot(readNoteSnapshotFromYDoc(doc));

    const handleUpdate = () => {
      setSnapshot(readNoteSnapshotFromYDoc(doc));
    };

    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc]);

  return snapshot;
}
