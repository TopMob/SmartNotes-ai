"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { foldersRepository } from "@/features/folders/api/folders-repository";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export function useFoldersQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");

  return useQuery({
    queryKey: queryKeys.folders(userId),
    queryFn: () => foldersRepository.list(),
    enabled: authStatus !== "loading",
  });
}
