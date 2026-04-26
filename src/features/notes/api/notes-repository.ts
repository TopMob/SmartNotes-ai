import type { Note, NoteDraft } from "@/entities/note";

export type NotesRepository = {
  list: () => Promise<Note[]>;
  create: (draft: NoteDraft) => Promise<Note>;
  patch: (noteId: string, patch: Partial<Note>) => Promise<Note>;
  trash: (noteId: string) => Promise<void>;
  restore: (noteId: string) => Promise<void>;
  remove: (noteId: string) => Promise<void>;
};

export const notesRepository: NotesRepository = {
  async list() {
    return [];
  },
  async create() {
    throw new Error("notesRepository.create is not implemented yet");
  },
  async patch() {
    throw new Error("notesRepository.patch is not implemented yet");
  },
  async trash() {
    throw new Error("notesRepository.trash is not implemented yet");
  },
  async restore() {
    throw new Error("notesRepository.restore is not implemented yet");
  },
  async remove() {
    throw new Error("notesRepository.remove is not implemented yet");
  },
};
