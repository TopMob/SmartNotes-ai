"use client";

import * as Y from "yjs";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeNotePatch } from "@/features/notes/lib/note-utils";

import type { Note } from "@/entities/note";
import { createNoteCollabChannel } from "@/features/editor-collab/api/create-note-collab-channel";
import { bindYjsSupabaseChannel } from "@/features/editor-collab/lib/bind-yjs-supabase-channel";
import { createNoteIndexeddbProvider } from "@/features/editor-collab/lib/create-note-indexeddb-provider";
import { applyNoteToYDoc, createEmptyYNoteDoc, readNoteSnapshotFromYDoc, type YNoteDocSnapshot } from "@/features/editor-collab/model/yjs-note-doc";
import type { IndexeddbPersistence } from "y-indexeddb";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { clearCollabDiagnostic, setCollabDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { decodeYjsUpdate, encodeYjsUpdate } from "@/features/editor-collab/lib/yjs-update-encoding";

type NoteCollabStatus = "hydrating" | "ready" | "error";

type DurableState = {
  isSaving: boolean;
  lastSavedAt: number | null;
  error: Error | null;
  hasUnsavedChanges: boolean;
};

type NoteCollabSessionValue = {
  doc: Y.Doc;
  noteId: string;
  status: NoteCollabStatus;
  error: Error | null;
  hydratedFromQuery: boolean;
  querySnapshotSerialized: string;
  durableState: DurableState;
  setDurableState: React.Dispatch<React.SetStateAction<DurableState>>;
};

const LOCAL_UPDATE_PREFIX = "smartnotes:collab:update:";

const NoteCollabSessionContext = createContext<NoteCollabSessionValue | null>(null);

function saveLocalUpdate(noteId: string, value: Uint8Array) {
  try {
    window.localStorage.setItem(LOCAL_UPDATE_PREFIX + noteId, encodeYjsUpdate(value));
  } catch {
    return;
  }
}

function loadLocalUpdate(noteId: string) {
  try {
    const value = window.localStorage.getItem(LOCAL_UPDATE_PREFIX + noteId);
    return value ? decodeYjsUpdate(value) : null;
  } catch {
    return null;
  }
}

type NoteCollabProviderProps = {
  note: Pick<Note, "id" | "title" | "folderId" | "userTags" | "content" | "pages">;
  children: ReactNode;
};

export function NoteCollabSessionProvider({ note, children }: NoteCollabProviderProps) {
  const sessionRef = useRef<{ noteId: string; doc: Y.Doc } | null>({
    noteId: note.id,
    doc: createEmptyYNoteDoc(),
  });
  const indexeddbRef = useRef<IndexeddbPersistence | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const transportRef = useRef<{ destroy: () => void } | null>(null);
  const didHydrateFromQueryRef = useRef(false);
  const [status, setStatus] = useState<NoteCollabStatus>("hydrating");
  const [error, setError] = useState<Error | null>(null);
  const [hydratedFromQuery, setHydratedFromQuery] = useState(false);
  const [durableState, setDurableState] = useState<DurableState>({
    isSaving: false,
    lastSavedAt: null,
    error: null,
    hasUnsavedChanges: false,
  });
  const querySnapshotSerialized = useMemo(() => JSON.stringify(normalizeNotePatch({
    title: note.title,
    folderId: note.folderId,
    userTags: note.userTags,
    content: note.content,
  }, { scheduleAnalysis: false })), [note.title, note.folderId, note.userTags, note.content]);

  useEffect(() => {
    const session = sessionRef.current;

    if (!session || session.noteId !== note.id) {
      return;
    }

    let indexeddb: IndexeddbPersistence | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      indexeddb = createNoteIndexeddbProvider(note.id, session.doc);
      indexeddbRef.current = indexeddb;
      channel = createNoteCollabChannel(note.id);
      channelRef.current = channel;
      transportRef.current = channel ? bindYjsSupabaseChannel({ noteId: note.id, channel, doc: session.doc }) : null;
      setCollabDiagnostic(note.id, {
        status: "hydrating",
        hydratedFromQuery: false,
        transport: channel ? "connected" : "idle",
        persistence: "idle",
        durable: "idle",
        message: channel ? "Started local persistence and realtime transport." : "Started local persistence without Supabase realtime transport.",
      });

      const localUpdate = loadLocalUpdate(note.id);

      if (localUpdate) {
        Y.applyUpdate(session.doc, localUpdate);
      }
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause : new Error("Failed to initialize collaborative note session."));
      setCollabDiagnostic(note.id, {
        status: "error",
        hydratedFromQuery: false,
        transport: "error",
        persistence: "error",
        durable: "error",
        message: cause instanceof Error ? cause.message : "Failed to initialize collaborative note session.",
      });
      return;
    }

    let cancelled = false;
    const handleUpdate = () => {
      saveLocalUpdate(note.id, Y.encodeStateAsUpdate(session.doc));
    };

    session.doc.on("update", handleUpdate);

    // Fast-path for brand-new empty notes: no need to wait for IndexedDB
    const isNewEmptyNote = !note.content && note.pages.every((p) => !p.content);

    function hydrateFromQuery(reason: string) {
      if (cancelled || didHydrateFromQueryRef.current || !session) return;
      try {
        applyNoteToYDoc(session.doc, note);
        didHydrateFromQueryRef.current = true;
        setHydratedFromQuery(true);
        setStatus("ready");
        setError(null);
        setCollabDiagnostic(note.id, {
          status: "ready",
          hydratedFromQuery: true,
          transport: channel ? "connected" : "idle",
          persistence: "synced",
          durable: "idle",
          message: reason,
        });
      } catch (cause) {
        setStatus("error");
        setError(cause instanceof Error ? cause : new Error("Failed to hydrate collaborative note session."));
      }
    }

    if (isNewEmptyNote) {
      hydrateFromQuery("New empty note — skipped IndexedDB wait, applied query snapshot immediately.");
    } else {
      // Safety timeout: if IndexedDB doesn't resolve in 600ms, force hydrate from query
      const hydrationTimeoutId = window.setTimeout(() => {
        if (!didHydrateFromQueryRef.current) {
          hydrateFromQuery("IndexedDB hydration timeout — fell back to query snapshot.");
        }
      }, 600);

      void indexeddb.whenSynced.then(() => {
        window.clearTimeout(hydrationTimeoutId);

        if (cancelled || didHydrateFromQueryRef.current) {
          return;
        }

        try {
          const indexedSnapshot = readNoteSnapshotFromYDoc(session.doc);
          const hasIndexedPages = indexedSnapshot.pages.some((page) => Boolean(page.content) || page.title !== "Page 1" || page.drawingDataUrl !== null || page.drawingRevision !== 0);

          if (!hasIndexedPages) {
            applyNoteToYDoc(session.doc, note);
          }

          didHydrateFromQueryRef.current = true;
          setHydratedFromQuery(true);
          setStatus("ready");
          setError(null);
          setCollabDiagnostic(note.id, {
            status: "ready",
            hydratedFromQuery: true,
            transport: channel ? "connected" : "idle",
            persistence: "synced",
            durable: durableState.error ? "error" : durableState.isSaving ? "saving" : durableState.lastSavedAt ? "saved" : "idle",
            message: hasIndexedPages ? "Restored local IndexedDB snapshot." : "Hydrated note session from durable query snapshot.",
          });
        } catch (cause) {
          setStatus("error");
          setError(cause instanceof Error ? cause : new Error("Failed to hydrate collaborative note session."));
          setCollabDiagnostic(note.id, {
            status: "error",
            hydratedFromQuery: false,
            transport: channel ? "connected" : "idle",
            persistence: "error",
            durable: "error",
            message: cause instanceof Error ? cause.message : "Failed to hydrate collaborative note session.",
          });
        }
      });
    }

    return () => {
      cancelled = true;
      session.doc.off("update", handleUpdate);
      transportRef.current?.destroy();
      transportRef.current = null;
      channelRef.current = null;
      indexeddbRef.current?.destroy();
      indexeddbRef.current = null;
      clearCollabDiagnostic(note.id);
    };
  }, [note.id]);

  useEffect(() => () => {
    transportRef.current?.destroy();
    transportRef.current = null;
    channelRef.current = null;
    indexeddbRef.current?.destroy();
    indexeddbRef.current = null;
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
      querySnapshotSerialized,
      durableState,
      setDurableState,
    };
  }, [durableState, error, hydratedFromQuery, querySnapshotSerialized, status]);

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
