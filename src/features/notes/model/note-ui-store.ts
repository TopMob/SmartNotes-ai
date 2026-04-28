import { create } from "zustand";

type NoteUiState = {
  currentNoteId: string | null;
  currentNotePageIndex: number;
  editorDirty: boolean;
  setCurrentNoteId: (noteId: string | null) => void;
  setCurrentNotePageIndex: (pageIndex: number) => void;
  markEditorDirty: (dirty: boolean) => void;
  reset: () => void;
};

export const useNoteUiStore = create<NoteUiState>((set) => ({
  currentNoteId: null,
  currentNotePageIndex: 0,
  editorDirty: false,
  setCurrentNoteId: (currentNoteId) => set({ currentNoteId }),
  setCurrentNotePageIndex: (currentNotePageIndex) => set({ currentNotePageIndex }),
  markEditorDirty: (editorDirty) => set({ editorDirty }),
  reset: () =>
    set({
      currentNoteId: null,
      currentNotePageIndex: 0,
      editorDirty: false,
    }),
}));
