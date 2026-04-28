import type { Note } from "@/entities/note";
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from "@/shared/lib/local-storage";

const LOCAL_NOTES_KEY = "smartnotes:local:notes";

function readNotes() {
  return readJsonFromLocalStorage<Note[]>(LOCAL_NOTES_KEY, []);
}

function writeNotes(notes: Note[]) {
  writeJsonToLocalStorage(LOCAL_NOTES_KEY, notes);
}

export const localNotesRepository = {
  async list() {
    return readNotes();
  },
  async create(note: Note) {
    const notes = readNotes();
    writeNotes([note, ...notes.filter((item) => item.id !== note.id)]);
    return note;
  },
  async batchCreate(notesToCreate: Note[]) {
    const notes = readNotes();
    const createIds = new Set(notesToCreate.map((note) => note.id));
    writeNotes([...notesToCreate, ...notes.filter((item) => !createIds.has(item.id))]);
    return notesToCreate;
  },
  async patch(noteId: string, patch: Partial<Note>) {
    const notes = readNotes();
    const nextNote = notes.find((item) => item.id === noteId);

    if (!nextNote) {
      throw new Error(`Local note ${noteId} not found.`);
    }

    const updated = { ...nextNote, ...patch };
    writeNotes(notes.map((item) => (item.id === noteId ? updated : item)));
    return updated;
  },
  async remove(noteId: string) {
    writeNotes(readNotes().filter((item) => item.id !== noteId));
  },
  async clearTrash() {
    writeNotes(readNotes().filter((item) => !item.trashedAt));
  },
};
