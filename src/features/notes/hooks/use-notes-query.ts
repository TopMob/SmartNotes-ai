"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

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
