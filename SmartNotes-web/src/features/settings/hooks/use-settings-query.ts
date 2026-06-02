"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { settingsRepository } from "@/features/settings/api/settings-repository";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export function useSettingsQuery() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");

  return useQuery({
    queryKey: queryKeys.settings(userId),
    queryFn: () => settingsRepository.get(userId),
    enabled: authStatus !== "loading",
  });
}
