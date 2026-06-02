import { create } from "zustand";

type LockState = {
  unlockedNotes: Set<string>;
  lastActivity: number;
  unlockNote: (noteId: string) => void;
  lockNote: (noteId: string) => void;
  lockAll: () => void;
  pingActivity: () => void;
};

export const useLockStore = create<LockState>((set) => ({
  unlockedNotes: new Set(),
  lastActivity: Date.now(),
  unlockNote: (noteId) => set((state) => {
    const next = new Set(state.unlockedNotes);
    next.add(noteId);
    return { unlockedNotes: next, lastActivity: Date.now() };
  }),
  lockNote: (noteId) => set((state) => {
    const next = new Set(state.unlockedNotes);
    next.delete(noteId);
    return { unlockedNotes: next };
  }),
  lockAll: () => set({ unlockedNotes: new Set() }),
  pingActivity: () => set({ lastActivity: Date.now() }),
}));