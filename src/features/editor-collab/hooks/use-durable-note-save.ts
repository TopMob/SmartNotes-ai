"use client";

import { useEffect, useRef } from "react";

import { buildDurableNotePatchFromYDoc } from "@/features/editor-collab/model/yjs-note-doc";
import type { Note } from "@/entities/note";
import { useUpdateNoteMutation } from "@/features/notes/hooks/use-note-mutations";
import { normalizeNotePatch } from "@/features/notes/lib/note-utils";
import { setCollabDiagnostic } from "@/services/diagnostics/runtime-diagnostics";

import { NOTE_COLLAB_SAVE_DEBOUNCE_MS } from "../lib/note-collab-constants";
import { useNoteCollabSession } from "./use-note-collab-session";

function serializeDurablePatch(value: Pick<Note, "title" | "folderId" | "userTags" | "pages" | "content"> | Partial<Note>) {
  return JSON.stringify(value);
}

export function useDurableNoteSave() {
  const { doc, noteId, hydratedFromQuery, querySnapshotSerialized, status, setDurableState } = useNoteCollabSession();
  const updateMutation = useUpdateNoteMutation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") {
      return;
    }

    lastSavedRef.current = querySnapshotSerialized;

    const currentSerialized = serializeDurablePatch(normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false }));
    const hasUnsavedChanges = currentSerialized !== querySnapshotSerialized;

    setDurableState({ isSaving: false, lastSavedAt: null, error: null, hasUnsavedChanges });
    setCollabDiagnostic(noteId, {
      status,
      hydratedFromQuery,
      transport: "connected",
      persistence: "synced",
      durable: hasUnsavedChanges ? "idle" : "saved",
      message: hasUnsavedChanges ? "Local note state diverged from durable snapshot." : "Durable snapshot is synchronized.",
    });
  }, [doc, hydratedFromQuery, querySnapshotSerialized, setDurableState, status, noteId]);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") {
      return;
    }

    const scheduleSave = () => {
      const nextPatch = normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false });
      const serialized = serializeDurablePatch(nextPatch);
      const hasChanges = serialized !== lastSavedRef.current;

      setDurableState((current) => ({
        ...current,
        error: null,
        hasUnsavedChanges: hasChanges,
      }));

      if (!hasChanges) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDurableState((current) => ({
          ...current,
          isSaving: true,
          error: null,
        }));
        setCollabDiagnostic(noteId, {
          status,
          hydratedFromQuery,
          transport: "connected",
          persistence: "synced",
          durable: "saving",
          message: "Persisting debounced durable snapshot.",
        });

        void updateMutation
          .mutateAsync({ noteId, patch: nextPatch })
          .then(() => {
            if (disposedRef.current) {
              return;
            }

            lastSavedRef.current = serialized;
            setDurableState({
              isSaving: false,
              lastSavedAt: Date.now(),
              error: null,
              hasUnsavedChanges: false,
            });
            setCollabDiagnostic(noteId, {
              status,
              hydratedFromQuery,
              transport: "connected",
              persistence: "synced",
              durable: "saved",
              message: "Durable snapshot saved successfully.",
            });
          })
          .catch((error: unknown) => {
            if (disposedRef.current) {
              return;
            }

            setDurableState((current) => ({
              ...current,
              isSaving: false,
              error: error instanceof Error ? error : new Error("Failed to persist collaborative note snapshot."),
            }));
            setCollabDiagnostic(noteId, {
              status,
              hydratedFromQuery,
              transport: "connected",
              persistence: "synced",
              durable: "error",
              message: error instanceof Error ? error.message : "Failed to persist collaborative note snapshot.",
            });
          });
      }, NOTE_COLLAB_SAVE_DEBOUNCE_MS);
    };

    doc.on("update", scheduleSave);

    return () => {
      doc.off("update", scheduleSave);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    scheduleSave();
  }, [doc, hydratedFromQuery, noteId, querySnapshotSerialized, setDurableState, status, updateMutation]);
}
