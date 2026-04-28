"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { notesRepository } from "@/features/notes/api/notes-repository";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export function useNotesQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: userId ? queryKeys.notes(userId) : ["notes", "anonymous"],
    queryFn: () => notesRepository.list(),
    enabled: authStatus === "authenticated" && !!userId,
  });
}
