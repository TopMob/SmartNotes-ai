"use client";

import { useEffect, useRef } from "react";

import { buildDurableNotePatchFromYDoc } from "@/features/editor-collab/model/yjs-note-doc";
import type { Note } from "@/entities/note";
import { useUpdateNoteMutation } from "@/features/notes/hooks/use-note-mutations";
import { normalizeNotePatch } from "@/features/notes/lib/note-utils";
import { setCollabDiagnostic } from "@/services/diagnostics/runtime-diagnostics";

import { NOTE_COLLAB_SAVE_DEBOUNCE_MS } from "../lib/note-collab-constants";
import { useNoteCollabSession } from "./use-note-collab-session";

function serializeContentSnapshot(patch: Partial<Note>) {
  return JSON.stringify({
    title: patch.title,
    folderId: patch.folderId,
    userTags: patch.userTags,
    content: patch.content,
  });
}

export function useDurableNoteSave() {
  const { doc, noteId, hydratedFromQuery, querySnapshotSerialized, status, setDurableState } = useNoteCollabSession();
  const updateMutation = useUpdateNoteMutation();
  const mutateRef = useRef(updateMutation.mutateAsync);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const hydratedRef = useRef(hydratedFromQuery);
  const statusRef = useRef(status);
  const noteIdRef = useRef(noteId);
  const setDurableStateRef = useRef(setDurableState);

  mutateRef.current = updateMutation.mutateAsync;
  hydratedRef.current = hydratedFromQuery;
  statusRef.current = status;
  noteIdRef.current = noteId;
  setDurableStateRef.current = setDurableState;

  useEffect(() => {
    disposedRef.current = false;
    return () => { disposedRef.current = true; };
  }, []);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") return;

    const baseSnapshot = serializeContentSnapshot(
      normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false })
    );
    const serverSnapshot = serializeContentSnapshot(
      JSON.parse(querySnapshotSerialized) as Partial<Note>
    );
    lastSavedRef.current = serverSnapshot;

    const hasUnsavedChanges = baseSnapshot !== serverSnapshot;
    setDurableState({ isSaving: false, lastSavedAt: null, error: null, hasUnsavedChanges });
    setCollabDiagnostic(noteId, {
      status, hydratedFromQuery,
      transport: "connected", persistence: "synced",
      durable: hasUnsavedChanges ? "idle" : "saved",
      message: hasUnsavedChanges ? "Local state diverged from server." : "Synchronized.",
    });
  }, [doc, hydratedFromQuery, querySnapshotSerialized, setDurableState, status, noteId]);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") return;

    const scheduleSave = () => {
      const curHydrated = hydratedRef.current;
      const curStatus = statusRef.current;
      const curNoteId = noteIdRef.current;

      if (!curHydrated || curStatus !== "ready") return;

      const nextPatch = normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false });
      const serialized = serializeContentSnapshot(nextPatch);
      const hasChanges = serialized !== lastSavedRef.current;

      setDurableStateRef.current((s) => ({ ...s, error: null, hasUnsavedChanges: hasChanges }));

      if (!hasChanges) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        setDurableStateRef.current((s) => ({ ...s, isSaving: true, error: null }));
        setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "saving", message: "Saving…" });

        void mutateRef.current({ noteId: curNoteId, patch: nextPatch })
          .then(() => {
            if (disposedRef.current) return;
            lastSavedRef.current = serialized;
            setDurableStateRef.current({ isSaving: false, lastSavedAt: Date.now(), error: null, hasUnsavedChanges: false });
            setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "saved", message: "Saved." });
          })
          .catch((err: unknown) => {
            if (disposedRef.current) return;
            setDurableStateRef.current((s) => ({ ...s, isSaving: false, error: err instanceof Error ? err : new Error("Save failed.") }));
            setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "error", message: err instanceof Error ? err.message : "Save failed." });
          });
      }, NOTE_COLLAB_SAVE_DEBOUNCE_MS);
    };

    doc.on("update", scheduleSave);

    return () => {
      doc.off("update", scheduleSave);
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, [doc, hydratedFromQuery, status]);
}
