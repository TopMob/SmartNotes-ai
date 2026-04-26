import { create } from "zustand";

import type { Note } from "@/entities/note";

type NotesState = {
  notes: Note[];
  currentNoteId: string | null;
  editorDirty: boolean;
  addNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  setNotes: (notes: Note[]) => void;
  setCurrentNoteId: (noteId: string | null) => void;
  markEditorDirty: (dirty: boolean) => void;
  patchNote: (noteId: string, patch: Partial<Note>) => void;
};

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  currentNoteId: null,
  editorDirty: false,
  addNote: (note) => set((state) => ({ notes: [note, ...state.notes], currentNoteId: note.id })),
  removeNote: (noteId) =>
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== noteId),
      currentNoteId: state.currentNoteId === noteId ? null : state.currentNoteId,
    })),
  setNotes: (notes) => set({ notes }),
  setCurrentNoteId: (currentNoteId) => set({ currentNoteId }),
  markEditorDirty: (editorDirty) => set({ editorDirty }),
  patchNote: (noteId, patch) =>
    set((state) => ({
      notes: state.notes.map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
    })),
}));
