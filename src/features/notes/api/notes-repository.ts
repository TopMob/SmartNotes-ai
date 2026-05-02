import type { Note, NoteDraft } from "@/entities/note";
import { isGuestUser } from "@/features/auth/lib/guest-session";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { localNotesRepository } from "@/features/notes/api/local-notes-repository";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { mapNoteDraftToInsert, mapNotePatchToUpdate, mapNoteRow } from "./note-mappers";

function shouldUseLocal(): boolean {
  const { status, user } = useAuthStore.getState();
  return status === "degraded" || !user || user.id === "local-user" || isGuestUser(user);
}

export type PaginationCursor = {
  limit: number;
  cursor?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type NotesRepository = {
  list: (cursor?: PaginationCursor) => Promise<PaginatedResult<Note>>;
  listAll: () => Promise<Note[]>;
  create: (note: Note) => Promise<Note>;
  patch: (noteId: string, patch: Partial<Note>) => Promise<Note>;
  batchCreate: (notes: Note[]) => Promise<Note[]>;
  trash: (noteId: string) => Promise<void>;
  restore: (noteId: string) => Promise<void>;
  clearTrash: () => Promise<void>;
  remove: (noteId: string) => Promise<void>;
};

export const notesRepository: NotesRepository = {
  async list(cursor?: PaginationCursor) {
    if (shouldUseLocal()) {
      const allNotes = await localNotesRepository.list();
      // Apply client-side pagination for local mode
      const limit = cursor?.limit ?? 50;
      const startIndex = cursor?.cursor
        ? allNotes.findIndex((n) => n.updatedAt < cursor.cursor!)
        : 0;
      const slice = allNotes.slice(startIndex >= 0 ? startIndex : 0, (startIndex >= 0 ? startIndex : 0) + limit + 1);
      const hasMore = slice.length > limit;
      const data = hasMore ? slice.slice(0, limit) : slice;
      return {
        data,
        nextCursor: data.length > 0 ? data[data.length - 1].updatedAt : null,
        hasMore,
      };
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.list().then((n) => ({ data: n, nextCursor: null, hasMore: false }));
    }

    const limit = cursor?.limit ?? 50;
    let query = supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit + 1);

    if (cursor?.cursor) {
      query = query.lt("updated_at", cursor.cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    const notes = rows.map(mapNoteRow);

    return {
      data: notes,
      nextCursor: notes.length > 0 ? notes[notes.length - 1].updatedAt : null,
      hasMore,
    };
  },
  async listAll() {
    if (shouldUseLocal()) {
      return localNotesRepository.list();
    }

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
    if (shouldUseLocal()) {
      return localNotesRepository.create(note);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.create(note);
    }

    const { error } = await supabase.from("notes").insert(mapNoteDraftToInsert(note));

    if (error) throw error;

    return note;
  },
  async patch(noteId, patch) {
    if (shouldUseLocal()) {
      return localNotesRepository.patch(noteId, patch);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localNotesRepository.patch(noteId, patch);
    }

    const { error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", noteId);

    if (error) throw error;

    return { id: noteId, ...patch } as Note;
  },
  async batchCreate(notes) {
    if (!notes.length) {
      return [];
    }

    if (shouldUseLocal()) {
      return localNotesRepository.batchCreate(notes);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) return localNotesRepository.batchCreate(notes);

    const chunkSize = 50;
    const created: Note[] = [];

    for (let index = 0; index < notes.length; index += chunkSize) {
      const chunk = notes.slice(index, index + chunkSize);
      const { data, error } = await supabase.from("notes").insert(chunk.map(mapNoteDraftToInsert)).select("*");

      if (error) throw error;

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
    if (shouldUseLocal()) {
      return localNotesRepository.clearTrash();
    }

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
    if (shouldUseLocal()) {
      return localNotesRepository.remove(noteId);
    }

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
