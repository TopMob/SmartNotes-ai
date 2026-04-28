import type { Note, NoteDraft } from "@/entities/note";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { mapNoteDraftToInsert, mapNotePatchToUpdate, mapNoteRow } from "./note-mappers";

export type NotesRepository = {
  list: () => Promise<Note[]>;
  create: (note: Note) => Promise<Note>;
  patch: (noteId: string, patch: Partial<Note>) => Promise<Note>;
  trash: (noteId: string) => Promise<void>;
  restore: (noteId: string) => Promise<void>;
  remove: (noteId: string) => Promise<void>;
};

export const notesRepository: NotesRepository = {
  async list() {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(mapNoteRow);
  },
  async create(note) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("notes").insert(mapNoteDraftToInsert(note)).select("*").single();

    if (error) {
      throw error;
    }

    return mapNoteRow(data);
  },
  async patch(noteId, patch) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", noteId).select("*").single();

    if (error) {
      throw error;
    }

    return mapNoteRow(data);
  },
  async trash(noteId) {
    await this.patch(noteId, { trashedAt: new Date().toISOString() });
  },
  async restore(noteId) {
    await this.patch(noteId, { trashedAt: null });
  },
  async remove(noteId) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("notes").delete().eq("id", noteId);

    if (error) {
      throw error;
    }
  },
};
