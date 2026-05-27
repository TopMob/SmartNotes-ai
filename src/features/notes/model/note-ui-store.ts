import { create } from "zustand";
import type { Note } from "@/entities/note";

type NoteUiState = {
  currentNoteId: string | null;
  currentNotePageIndex: number;
  editorDirty: boolean;
  draftNote: Note | null;
  setCurrentNoteId: (noteId: string | null) => void;
  setCurrentNotePageIndex: (pageIndex: number) => void;
  markEditorDirty: (dirty: boolean) => void;
  setDraftNote: (note: Note | null) => void;
  reset: () => void;
};

export const useNoteUiStore = create<NoteUiState>((set) => ({
  currentNoteId: null,
  currentNotePageIndex: 0,
  editorDirty: false,
  draftNote: null,
  setCurrentNoteId: (currentNoteId) => set({ currentNoteId }),
  setCurrentNotePageIndex: (currentNotePageIndex) => set({ currentNotePageIndex }),
  markEditorDirty: (editorDirty) => set({ editorDirty }),
  setDraftNote: (draftNote) => set({ draftNote }),
  reset: () =>
    set({
      currentNoteId: null,
      currentNotePageIndex: 0,
      editorDirty: false,
      draftNote: null,
    }),
}));

