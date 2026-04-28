"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UserSettings, UserSettingsPatch } from "@/entities/settings";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { settingsRepository } from "@/features/settings/api/settings-repository";
import { DEFAULT_EDITOR_SETTINGS, DEFAULT_USER_SETTINGS, clampOpacity, normalizeNotesPerPage } from "@/features/settings/lib/settings-defaults";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

type SettingsSnapshot = { previousSettings: UserSettings | undefined };

function normalizeSettingsPatch(patch: UserSettingsPatch): UserSettingsPatch {
  return {
    ...patch,
    ...(patch.uiOpacity === undefined ? null : { uiOpacity: clampOpacity(patch.uiOpacity) }),
    ...(patch.cardsOpacity === undefined ? null : { cardsOpacity: clampOpacity(patch.cardsOpacity) }),
    ...(patch.notesPerPage === undefined ? null : { notesPerPage: normalizeNotesPerPage(patch.notesPerPage) }),
    ...(patch.customPresets === undefined ? null : { customPresets: patch.customPresets.slice(0, 6) }),
  };
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async (patch: UserSettingsPatch) => settingsRepository.patch(userId!, normalizeSettingsPatch(patch)),
    onMutate: async (patch) => {
      if (!userId) {
        return { previousSettings: undefined } satisfies SettingsSnapshot;
      }

      const queryKey = queryKeys.settings(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousSettings = queryClient.getQueryData<UserSettings>(queryKey);
      const normalizedPatch = normalizeSettingsPatch(patch);

      queryClient.setQueryData<UserSettings>(queryKey, (current) =>
        current
          ? {
              ...current,
              ...normalizedPatch,
            }
          : undefined,
      );

      return { previousSettings } satisfies SettingsSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) {
        return;
      }

      queryClient.setQueryData(queryKeys.settings(userId), context.previousSettings);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.settings(userId) });
    },
  });
}

export function useSettingsActions() {
  const updateMutation = useUpdateSettingsMutation();

  return {
    patchSettings: (patch: UserSettingsPatch) => updateMutation.mutateAsync(patch),
    resetSettings: () =>
      updateMutation.mutateAsync({
        ...DEFAULT_USER_SETTINGS,
        editor: DEFAULT_EDITOR_SETTINGS,
      }),
  };
}
