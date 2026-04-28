"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { foldersRepository } from "@/features/folders/api/folders-repository";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export function useFoldersQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: userId ? queryKeys.folders(userId) : ["folders", "anonymous"],
    queryFn: () => foldersRepository.list(),
    enabled: authStatus === "authenticated" && !!userId,
  });
}
