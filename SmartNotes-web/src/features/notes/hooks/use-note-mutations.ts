"use client";
import { nowIso } from "@/shared/utils/date";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { MediaDescriptor, Note, NoteDraft } from "@/entities/note";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { notesRepository } from "@/features/notes/api/notes-repository";
import {
  ANALYSIS_FIELD_KEYS,
  buildMediaPatch,
  buildPageAddPatch,
  buildPageDeletePatch,
  buildPageUpdatePatch,
  createLocalNote,
  normalizeNotePatch,
  type NotePagePatch,
} from "@/features/notes/lib/note-utils";
import { scheduleAiAnalysis } from "@/services/ai/ai-queue";
import { enqueueSyncItem } from "@/services/sync/sync-queue";
import { publish } from "@/services/event-bus";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

type InfiniteNotesData = {
  pages: Array<{ data: Note[]; nextCursor: string | null; hasMore: boolean }>;
  pageParams: unknown[];
};

type NotesSnapshot = { previousNotes: Note[] | undefined };

function shouldScheduleAnalysisFromPatch(patch: Partial<Note>) {
  if (patch.aiStatus === "pending" || patch.aiProcessed === false || patch.analyzed === false) {
    return true;
  }

  return ANALYSIS_FIELD_KEYS.some((field) => {
    if (!(field in patch)) {
      return false;
    }

    const value = patch[field];

    if (field === "title" || field === "content") {
      return typeof value === "string";
    }

    if (field === "pages") {
      return Array.isArray(value);
    }

    if (field === "userTags" || field === "hiddenTags" || field === "media") {
      return Array.isArray(value);
    }

    return value !== undefined;
  });
}

function updateNoteDetailCache(queryClient: ReturnType<typeof useQueryClient>, userId: string | null, noteId: string, updater: (note: Note | null) => Note | null) {
  if (!userId) {
    return;
  }

  const queryKey = queryKeys.noteDetail(userId, noteId);
  queryClient.setQueryData<Note | null>(queryKey, (current) => updater(current ?? null));
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function getFlatNotes(data: InfiniteNotesData | undefined): Note[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

function updateFirstPageNotes(data: InfiniteNotesData | undefined, updater: (notes: Note[]) => Note[]): InfiniteNotesData {
  if (!data) {
    return {
      pages: [{ data: updater([]), nextCursor: null, hasMore: false }],
      pageParams: [undefined],
    };
  }
  return {
    ...data,
    pages: data.pages.map((page, i) => (i === 0 ? { ...page, data: updater(page.data) } : page)),
  };
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async ({ draft, optimisticNote }: { draft: NoteDraft; optimisticNote?: Note }) => {
      const note = optimisticNote ?? createLocalNote(draft, userId ?? "local-user");
      return notesRepository.create(note);
    },
    onMutate: async ({ draft, optimisticNote }) => {
      if (!userId) {
        return { previousNotes: undefined, optimisticNote: undefined };
      }

      const queryKey = queryKeys.notes(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteNotesData>(queryKey);
      const previousNotes = getFlatNotes(previousData);
      const localNote = optimisticNote ?? createLocalNote(draft, userId);

      queryClient.setQueryData<InfiniteNotesData>(queryKey, updateFirstPageNotes(previousData, (notes) =>
        sortNotes([localNote, ...notes])
      ));

      return { previousNotes, optimisticNote: localNote };
    },
    onError: (_error, _vars, context) => {
      if (!userId) return;
      const queryKey = queryKeys.notes(userId);
      const optimistic = (context as { optimisticNote?: Note } | undefined)?.optimisticNote;
      if (!optimistic) { void queryClient.invalidateQueries({ queryKey }); return; }
      const current = queryClient.getQueryData<InfiniteNotesData>(queryKey);
      const alreadyPresent = getFlatNotes(current).some((n) => n.id === optimistic.id);
      if (!alreadyPresent) {
        queryClient.setQueryData<InfiniteNotesData>(queryKey, updateFirstPageNotes(current, (notes) =>
          sortNotes([optimistic, ...notes])
        ));
      }
    },
    onSuccess: (note) => {
      if (userId) {
        queryClient.setQueryData(queryKeys.noteDetail(userId, note.id), note);
      }
      enqueueSyncItem({ id: note.id, entity: "note", operation: "create", payload: { noteId: note.id } });
      scheduleAiAnalysis(note.id);
    },
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
  });
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async ({ noteId, patch }: { noteId: string; patch: Partial<Note> }) => notesRepository.patch(noteId, patch),
    onMutate: async ({ noteId, patch }) => {
      if (!userId) {
        return { previousNotes: undefined } satisfies NotesSnapshot;
      }

      const queryKey = queryKeys.notes(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteNotesData>(queryKey);
      const previousNotes = getFlatNotes(previousData);

      queryClient.setQueryData<InfiniteNotesData>(queryKey, updateFirstPageNotes(previousData, (notes) =>
        sortNotes(notes.map((note) => (note.id === noteId ? { ...note, ...patch } : note)))
      ));
      updateNoteDetailCache(queryClient, userId, noteId, (note) => (note ? { ...note, ...patch } : note));

      return { previousNotes } satisfies NotesSnapshot;
    },
    onError: (error) => {
      if (!userId) return;
      publish("syncFailed", { message: error instanceof Error ? error.message : "Failed to update note." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
    onSuccess: (_note, { noteId, patch }) => {
      enqueueSyncItem({ id: noteId, entity: "note", operation: "patch", payload: patch });

      if (shouldScheduleAnalysisFromPatch(patch)) {
        scheduleAiAnalysis(noteId);
      }
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
      void queryClient.invalidateQueries({ queryKey: ["note-detail", userId] });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async (noteId: string) => notesRepository.remove(noteId),
    onMutate: async (noteId) => {
      if (!userId) {
        return { previousNotes: undefined } satisfies NotesSnapshot;
      }

      const queryKey = queryKeys.notes(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteNotesData>(queryKey);
      const previousNotes = getFlatNotes(previousData);

      queryClient.setQueryData<InfiniteNotesData>(queryKey, updateFirstPageNotes(previousData, (notes) =>
        notes.filter((note) => note.id !== noteId)
      ));
      queryClient.removeQueries({ queryKey: queryKeys.noteDetail(userId, noteId) });

      return { previousNotes } satisfies NotesSnapshot;
    },
    onError: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
    onSuccess: (_data, noteId) => {
      enqueueSyncItem({ id: noteId, entity: "note", operation: "delete", payload: null });
    },
  });
}

export function useClearTrashMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async () => notesRepository.clearTrash(),
    onMutate: async () => {
      if (!userId) {
        return { previousNotes: undefined } satisfies NotesSnapshot;
      }

      const queryKey = queryKeys.notes(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteNotesData>(queryKey);
      const previousNotes = getFlatNotes(previousData);

      queryClient.setQueryData<InfiniteNotesData>(queryKey, updateFirstPageNotes(previousData, (notes) =>
        notes.filter((note) => !note.trashedAt)
      ));

      return { previousNotes } satisfies NotesSnapshot;
    },
    onError: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
    onSuccess: () => {
      enqueueSyncItem({ id: "trash", entity: "note", operation: "delete", payload: { scope: "trash" } });
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
  });
}

export function useReorderNotesMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async (orderedNoteIds: string[]) => {
      const updates = orderedNoteIds.map((noteId, order) => ({ noteId, order }));
      await Promise.all(updates.map(({ noteId, order }) => notesRepository.patch(noteId, { order })));
    },
    onMutate: async (orderedNoteIds) => {
      if (!userId) {
        return { previousNotes: undefined } satisfies NotesSnapshot;
      }

      const queryKey = queryKeys.notes(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteNotesData>(queryKey);

      const orderById = new Map(orderedNoteIds.map((noteId, order) => [noteId, order]));

      queryClient.setQueryData<InfiniteNotesData>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.map((note) => {
              const order = orderById.get(note.id);
              return order === undefined ? note : { ...note, order };
            }),
          })),
        };
      });

      return { previousNotes: previousData ? getFlatNotes(previousData) : undefined } satisfies NotesSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(userId) });
    },
  });
}

export function useNoteActions() {
  const queryClient = useQueryClient();
  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();
  const clearTrashMutation = useClearTrashMutation();
  const reorderMutation = useReorderNotesMutation();
  const userId = useAuthStore((state) => state.user?.id ?? null);

    function findNote(noteId: string) {
    const detail = queryClient.getQueryData<Note | null>(queryKeys.noteDetail(userId ?? "local-user", noteId));

    if (detail) {
      return detail;
    }

    const queryData = queryClient.getQueryData<{ pages: Array<{ data: Note[] }> }>(queryKeys.notes(userId ?? "local-user"));
    const notes = queryData?.pages.flatMap((page) => page.data) ?? [];
    return notes.find((item) => item.id === noteId) ?? null;
  }

  return {
    createNote: (draft: NoteDraft, ownerId: string, optimisticNote = createLocalNote(draft, ownerId)) =>
      createMutation.mutateAsync({ draft, optimisticNote }),
    patchNote: async (noteId: string, patch: Partial<Note>, options?: { scheduleAnalysis?: boolean }) => {
      const note = findNote(noteId);

      if (!note) {
        return;
      }

      const normalizedPatch = normalizeNotePatch(patch, options);
      await updateMutation.mutateAsync({ noteId, patch: normalizedPatch });
    },
    trashNote: (noteId: string) => updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ trashedAt: nowIso() }, { scheduleAnalysis: false }) }),
    restoreNote: (noteId: string) => updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ trashedAt: null }, { scheduleAnalysis: false }) }),
    permanentlyDeleteNote: (noteId: string) => deleteMutation.mutateAsync(noteId),
    clearTrash: () => clearTrashMutation.mutateAsync(),
    togglePinned: (noteId: string) => {
      const note = findNote(noteId);
      return note ? updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ pinned: !note.pinned }, { scheduleAnalysis: false, keepTimestamp: true }) }) : Promise.resolve();
    },
    toggleFavorite: (noteId: string) => {
      const note = findNote(noteId);
      return note ? updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ favorite: !note.favorite }, { scheduleAnalysis: false, keepTimestamp: true }) }) : Promise.resolve();
    },
    setArchived: (noteId: string, isArchived: boolean) =>
      updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ isArchived }, { scheduleAnalysis: false }) }),
    setReminder: (noteId: string, reminderAt: string | null) =>
      updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch({ reminderAt }, { scheduleAnalysis: false }) }),
    moveNoteToFolder: (noteId: string, folderId: string | null) => {
      const note = findNote(noteId);

      return updateMutation.mutateAsync({
        noteId,
        patch: normalizeNotePatch(
          {
            folderId,
            folderOrder: folderId ? Date.now() : null,
            hiddenTags: note ? Array.from(new Set([...note.hiddenTags, "manual-folder-signal"])) : undefined,
          },
          { scheduleAnalysis: true },
        ),
      });
    },
    addPage: (noteId: string, title?: string) => {
      const note = findNote(noteId);

      if (!note) {
        return null;
      }

      const { page, patch } = buildPageAddPatch(note, title);
      void updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch(patch) });
      return page;
    },
    updatePage: (noteId: string, pageId: string, patch: NotePagePatch) => {
      const note = findNote(noteId);

      if (!note) {
        return;
      }

      void updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch(buildPageUpdatePatch(note, pageId, patch)) });
    },
    deletePage: (noteId: string, pageId: string) => {
      const note = findNote(noteId);

      if (!note) {
        return false;
      }

      const patch = buildPageDeletePatch(note, pageId);

      if (!patch) {
        return false;
      }

      void updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch(patch) });
      return true;
    },
    attachMedia: (noteId: string, media: MediaDescriptor) => {
      const note = findNote(noteId);

      if (!note) {
        return;
      }

      void updateMutation.mutateAsync({ noteId, patch: normalizeNotePatch(buildMediaPatch(note, media)) });
    },
    reorderNotes: (orderedNoteIds: string[]) => reorderMutation.mutateAsync(orderedNoteIds),
  };
}
