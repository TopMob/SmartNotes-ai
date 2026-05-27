"use client";

import { useEffect, useRef, useCallback } from "react";

import { buildDurableNotePatchFromYDoc } from "@/features/editor-collab/model/yjs-note-doc";
import type { Note } from "@/entities/note";
import { useUpdateNoteMutation, useCreateNoteMutation } from "@/features/notes/hooks/use-note-mutations";
import { normalizeNotePatch } from "@/features/notes/lib/note-utils";
import { setCollabDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";

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
  const createMutation = useCreateNoteMutation();
  const draftNote = useNoteUiStore((state) => state.draftNote);
  const setDraftNote = useNoteUiStore((state) => state.setDraftNote);

  const mutateRef = useRef(updateMutation.mutateAsync);
  const createMutateRef = useRef(createMutation.mutateAsync);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const hydratedRef = useRef(hydratedFromQuery);
  const statusRef = useRef(status);
  const noteIdRef = useRef(noteId);
  const setDurableStateRef = useRef(setDurableState);
  const draftNoteRef = useRef(draftNote);
  const setDraftNoteRef = useRef(setDraftNote);

  mutateRef.current = updateMutation.mutateAsync;
  createMutateRef.current = createMutation.mutateAsync;
  hydratedRef.current = hydratedFromQuery;
  statusRef.current = status;
  noteIdRef.current = noteId;
  setDurableStateRef.current = setDurableState;
  draftNoteRef.current = draftNote;
  setDraftNoteRef.current = setDraftNote;

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

  const flush = useCallback(async () => {
    const curHydrated = hydratedRef.current;
    const curStatus = statusRef.current;
    const curNoteId = noteIdRef.current;
    const curDraftNote = draftNoteRef.current;

    if (!curHydrated || curStatus !== "ready") return;

    const nextPatch = normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false });
    const serialized = serializeContentSnapshot(nextPatch);
    const hasChanges = serialized !== lastSavedRef.current;

    if (!hasChanges) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setDurableStateRef.current((s) => ({ ...s, isSaving: true, error: null }));
    setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "saving", message: "Saving…" });

    if (curDraftNote && curDraftNote.id === curNoteId) {
      const cleanContent = (nextPatch.content ?? "")
        .replace(/<p><\/p>/g, "")
        .replace(/<p><br><\/p>/g, "")
        .trim();
      const titleText = (nextPatch.title ?? "").trim();
      const isTitleNonEmpty = titleText.length > 0 && titleText !== "Untitled note";
      const hasContent = isTitleNonEmpty || cleanContent.length > 0;

      if (!hasContent) {
        setDurableStateRef.current((s) => ({ ...s, isSaving: false }));
        return;
      }

      try {
        await createMutateRef.current({
          draft: {
            title: nextPatch.title ?? "",
            content: nextPatch.content ?? "",
            folderId: curDraftNote.folderId,
            userTags: nextPatch.userTags ?? [],
          },
          optimisticNote: {
            ...curDraftNote,
            title: nextPatch.title ?? curDraftNote.title,
            content: nextPatch.content ?? curDraftNote.content,
            pages: nextPatch.pages ?? curDraftNote.pages,
            userTags: nextPatch.userTags ?? curDraftNote.userTags,
          }
        });
        if (disposedRef.current) return;
        lastSavedRef.current = serialized;
        setDraftNoteRef.current(null); // Clear the draft flag, it is now in the DB
        setDurableStateRef.current({ isSaving: false, lastSavedAt: Date.now(), error: null, hasUnsavedChanges: false });
        setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "saved", message: "Saved." });
      } catch (err: unknown) {
        if (disposedRef.current) return;
        setDurableStateRef.current((s) => ({ ...s, isSaving: false, error: err instanceof Error ? err : new Error("Save failed.") }));
        setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "error", message: err instanceof Error ? err.message : "Save failed." });
      }
    } else {
      try {
        await mutateRef.current({ noteId: curNoteId, patch: nextPatch });
        if (disposedRef.current) return;
        lastSavedRef.current = serialized;
        setDurableStateRef.current({ isSaving: false, lastSavedAt: Date.now(), error: null, hasUnsavedChanges: false });
        setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "saved", message: "Saved." });
      } catch (err: unknown) {
        if (disposedRef.current) return;
        setDurableStateRef.current((s) => ({ ...s, isSaving: false, error: err instanceof Error ? err : new Error("Save failed.") }));
        setCollabDiagnostic(curNoteId, { status: curStatus, hydratedFromQuery: curHydrated, transport: "connected", persistence: "synced", durable: "error", message: err instanceof Error ? err.message : "Save failed." });
      }
    }
  }, [doc]);

  useEffect(() => {
    if (!hydratedFromQuery || status !== "ready") return;

    const scheduleSave = () => {
      const curHydrated = hydratedRef.current;
      const curStatus = statusRef.current;

      if (!curHydrated || curStatus !== "ready") return;

      const nextPatch = normalizeNotePatch(buildDurableNotePatchFromYDoc(doc), { scheduleAnalysis: false });
      const serialized = serializeContentSnapshot(nextPatch);
      const hasChanges = serialized !== lastSavedRef.current;

      setDurableStateRef.current((s) => ({ ...s, error: null, hasUnsavedChanges: hasChanges }));

      if (!hasChanges) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        void flush();
      }, NOTE_COLLAB_SAVE_DEBOUNCE_MS);
    };

    doc.on("update", scheduleSave);

    return () => {
      doc.off("update", scheduleSave);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        void flush();
      }
    };
  }, [doc, hydratedFromQuery, status, flush]);

  return { flush };
}

