"use client";

import { useEffect, useRef } from "react";

import { buildDurableNotePatchFromYDoc } from "@/features/editor-collab/model/yjs-note-doc";
import type { Note } from "@/entities/note";
import { useUpdateNoteMutation } from "@/features/notes/hooks/use-note-mutations";
import { normalizeNotePatch } from "@/features/notes/lib/note-utils";
import { setCollabDiagnostic } from "@/services/diagnostics/runtime-diagnostics";

import { NOTE_COLLAB_SAVE_DEBOUNCE_MS } from "../lib/note-collab-constants";
import { useNoteCollabSession } from "./use-note-collab-session";

function serializePatch(patch: Partial<Note>) {
  return JSON.stringify({
    title: patch.title,
    folderId: patch.folderId,
    userTags: patch.userTags,
    content: patch.content,
    updatedAt: patch.updatedAt,
  });
}

export function useDurableNoteSave() {
  const { doc, noteId, hydratedFromQuery, querySnapshotSerialized, status, setDurableState } = useNoteCollabSession();
  const updateMutation = useUpdateNoteMutation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => { disposedRef.current = true; };
  }, []);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") return;

    lastSavedRef.current = querySnapshotSerialized;

    const current = serializePatch(normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false }));
    const hasUnsavedChanges = current !== querySnapshotSerialized;

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
      const nextPatch = normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false });
      const serialized = serializePatch(nextPatch);
      const hasChanges = serialized !== lastSavedRef.current;

      setDurableState((s) => ({ ...s, error: null, hasUnsavedChanges: hasChanges }));

      if (!hasChanges) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        setDurableState((s) => ({ ...s, isSaving: true, error: null }));
        setCollabDiagnostic(noteId, { status, hydratedFromQuery, transport: "connected", persistence: "synced", durable: "saving", message: "Saving…" });

        void updateMutation
          .mutateAsync({ noteId, patch: nextPatch })
          .then(() => {
            if (disposedRef.current) return;
            lastSavedRef.current = serialized;
            setDurableState({ isSaving: false, lastSavedAt: Date.now(), error: null, hasUnsavedChanges: false });
            setCollabDiagnostic(noteId, { status, hydratedFromQuery, transport: "connected", persistence: "synced", durable: "saved", message: "Saved." });
          })
          .catch((err: unknown) => {
            if (disposedRef.current) return;
            setDurableState((s) => ({ ...s, isSaving: false, error: err instanceof Error ? err : new Error("Save failed.") }));
            setCollabDiagnostic(noteId, { status, hydratedFromQuery, transport: "connected", persistence: "synced", durable: "error", message: err instanceof Error ? err.message : "Save failed." });
          });
      }, NOTE_COLLAB_SAVE_DEBOUNCE_MS);
    };

    scheduleSave();
    doc.on("update", scheduleSave);

    return () => {
      doc.off("update", scheduleSave);
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, [doc, hydratedFromQuery, noteId, querySnapshotSerialized, setDurableState, status, updateMutation]);
}
