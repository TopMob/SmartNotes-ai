"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { notesRepository, type PaginationCursor } from "@/features/notes/api/notes-repository";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

const DEFAULT_PAGE_SIZE = 50;

export function useNotesQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");

  return useInfiniteQuery({
    queryKey: queryKeys.notes(userId),
    queryFn: ({ pageParam }) => notesRepository.list(pageParam),
    initialPageParam: { limit: DEFAULT_PAGE_SIZE } as PaginationCursor,
    getNextPageParam: (lastPage): PaginationCursor | undefined => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      return { limit: DEFAULT_PAGE_SIZE, cursor: lastPage.nextCursor };
    },
    enabled: authStatus !== "loading",
  });
}

/** Flat list of all notes from all pages */
export function useNotesFlat() {
  const query = useNotesQuery();
  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.data) ?? [],
  };
}

export function useNoteDetails(noteId: string | null) {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");

  return useQuery({
    queryKey: noteId ? queryKeys.noteDetail(userId, noteId) : ["note-detail", userId, "idle"],
    queryFn: () => (noteId ? notesRepository.getById(noteId) : Promise.resolve(null)),
    enabled: authStatus !== "loading" && Boolean(noteId),
    staleTime: 30_000,
  });
}

import { collabRepository } from "@/features/editor-collab/api/collab-repository";

export function useInvitesQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const email = useAuthStore((state) => state.user?.email);

  return useQuery({
    queryKey: ["invites", email ?? ""],
    queryFn: () => (email ? collabRepository.fetchMyPendingInvites(email) : Promise.resolve([])),
    enabled: authStatus === "authenticated" && Boolean(email),
  });
}

