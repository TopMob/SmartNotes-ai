"use client";

import { useCallback } from "react";

import type { Note } from "@/entities/note";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { createLocalNote } from "@/features/notes/lib/note-utils";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";

import type { SheetAnchor, SheetName } from "../components/shared";

export function useNoteInteractions(options: {
  activeFolderId: string | null;
  setEditorOpen: (open: boolean) => void;
  openSheet: (name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  setFiltersOpen: (open: boolean) => void;
}) {
  const { activeFolderId, setEditorOpen, openSheet, setFiltersOpen } = options;
  const { createNote } = useNoteActions();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const setCurrentNoteId = useNoteUiStore((state) => state.setCurrentNoteId);
  const setCurrentNotePageIndex = useNoteUiStore((state) => state.setCurrentNotePageIndex);
  const authUser = useAuthStore((state) => state.user);

  const openNote = useCallback(
    (noteId: string, notes: Note[]) => {
      const note = notes.find((item) => item.id === noteId);
      if (!note) return;

      setCurrentNoteId(noteId);
      setCurrentNotePageIndex(0);
      setFiltersOpen(false);

      if (note.lock?.hidden) {
        openSheet("lock");
        return;
      }

      setEditorOpen(true);
    },
    [setCurrentNoteId, setCurrentNotePageIndex, setFiltersOpen, openSheet, setEditorOpen],
  );

  const createNoteDraft = useCallback(() => {
    const note = createLocalNote(
      { title: "", content: "", folderId: activeFolderId, userTags: [] },
      authUser?.id ?? "local-user",
    );
    void createNote({ title: "", content: "", folderId: activeFolderId, userTags: [] }, authUser?.id ?? "local-user", note);
    setCurrentNoteId(note.id);
    setEditorOpen(true);
  }, [activeFolderId, authUser?.id, createNote, setCurrentNoteId, setEditorOpen]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setCurrentNoteId(null);
    setCurrentNotePageIndex(0);
  }, [setEditorOpen, setCurrentNoteId, setCurrentNotePageIndex]);

  return {
    currentNoteId,
    openNote,
    createNoteDraft,
    closeEditor,
  };
}
