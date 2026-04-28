import type { Note, NoteDraft } from "@/entities/note";
import { localNotesRepository } from "@/features/notes/api/local-notes-repository";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { mapNoteDraftToInsert, mapNotePatchToUpdate, mapNoteRow } from "./note-mappers";

export type NotesRepository = {
  list: () => Promise<Note[]>;
  create: (note: Note) => Promise<Note>;
  patch: (noteId: string, patch: Partial<Note>) => Promise<Note>;
  batchCreate: (notes: Note[]) => Promise<Note[]>;
  trash: (noteId: string) => Promise<void>;
  restore: (noteId: string) => Promise<void>;
  clearTrash: () => Promise<void>;
  remove: (noteId: string) => Promise<void>;
};

export const notesRepository: NotesRepository = {
  async list() {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.list();
    }

    const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(mapNoteRow);
  },
  async create(note) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.create(note);
    }

    const { data, error } = await supabase.from("notes").insert(mapNoteDraftToInsert(note)).select("*").single();

    if (error) {
      throw error;
    }

    return mapNoteRow(data);
  },
  async patch(noteId, patch) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.patch(noteId, patch);
    }

    const { data, error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", noteId).select("*").single();

    if (error) {
      throw error;
    }

    return mapNoteRow(data);
  },
  async batchCreate(notes) {
    const supabase = createSupabaseBrowserClient();

    if (!notes.length) {
      return [];
    }

    if (!supabase) {
      return localNotesRepository.batchCreate(notes);
    }

    const chunkSize = 50;
    const created: Note[] = [];

    for (let index = 0; index < notes.length; index += chunkSize) {
      const chunk = notes.slice(index, index + chunkSize);
      const { data, error } = await supabase.from("notes").insert(chunk.map(mapNoteDraftToInsert)).select("*");

      if (error) {
        throw error;
      }

      created.push(...data.map(mapNoteRow));
    }

    return created;
  },
  async trash(noteId) {
    await this.patch(noteId, { trashedAt: new Date().toISOString() });
  },
  async restore(noteId) {
    await this.patch(noteId, { trashedAt: null });
  },
  async clearTrash() {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.clearTrash();
    }

    const { error } = await supabase.from("notes").delete().not("trashed_at", "is", null);

    if (error) {
      throw error;
    }
  },
  async remove(noteId) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.remove(noteId);
    }

    const { error } = await supabase.from("notes").delete().eq("id", noteId);

    if (error) {
      throw error;
    }
  },
};
