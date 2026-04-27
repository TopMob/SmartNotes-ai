import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { Note } from "@/entities/note";

const starterNotes: Note[] = [];

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function createSafeStorage() {
  if (typeof window === "undefined") {
    return memoryStorage;
  }

  return window.localStorage;
}

type NotesState = {
  notes: Note[];
  currentNoteId: string | null;
  currentNotePageIndex: number;
  editorDirty: boolean;
  addNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  setNotes: (notes: Note[]) => void;
  setCurrentNoteId: (noteId: string | null) => void;
  setCurrentNotePageIndex: (pageIndex: number) => void;
  markEditorDirty: (dirty: boolean) => void;
  patchNote: (noteId: string, patch: Partial<Note>) => void;
};

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: starterNotes,
      currentNoteId: null,
      currentNotePageIndex: 0,
      editorDirty: false,
      addNote: (note) => set((state) => ({ notes: [note, ...state.notes], currentNoteId: note.id })),
      removeNote: (noteId) =>
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== noteId),
          currentNoteId: state.currentNoteId === noteId ? null : state.currentNoteId,
          currentNotePageIndex: state.currentNoteId === noteId ? 0 : state.currentNotePageIndex,
        })),
      setNotes: (notes) => set({ notes }),
      setCurrentNoteId: (currentNoteId) => set({ currentNoteId }),
      setCurrentNotePageIndex: (currentNotePageIndex) => set({ currentNotePageIndex }),
      markEditorDirty: (editorDirty) => set({ editorDirty }),
      patchNote: (noteId, patch) =>
        set((state) => ({
          notes: state.notes.map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
        })),
    }),
    {
      name: "smartnotes-notes",
      version: 1,
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) => ({
        notes: state.notes,
        currentNoteId: state.currentNoteId,
        currentNotePageIndex: state.currentNotePageIndex,
      }),
    },
  ),
);
