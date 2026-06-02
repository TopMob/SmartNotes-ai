"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Folder, FolderDraft } from "@/entities/folder";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { foldersRepository } from "@/features/folders/api/folders-repository";
import { createLocalFolder, normalizeFolderPatch, nowIso } from "@/features/folders/lib/folder-utils";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

import { useFoldersQuery } from "./use-folders-query";

type FoldersSnapshot = { previousFolders: Folder[] | undefined };

function sortFolders(folders: Folder[]) {
  return [...folders].sort((left, right) => left.folderOrder - right.folderOrder);
}

export function useCreateFolderMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async ({ draft, ownerId, folderOrder }: { draft: FolderDraft; ownerId: string; folderOrder: number }) =>
      foldersRepository.create(draft, ownerId, folderOrder),
    onMutate: async ({ draft, ownerId, folderOrder }) => {
      if (!userId) {
        return { previousFolders: undefined } satisfies FoldersSnapshot;
      }

      const queryKey = queryKeys.folders(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKey);
      const optimisticFolder = createLocalFolder(draft, ownerId, folderOrder);

      queryClient.setQueryData<Folder[]>(queryKey, sortFolders([...(previousFolders ?? []), optimisticFolder]));

      return { previousFolders } satisfies FoldersSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) {
        return;
      }

      queryClient.setQueryData(queryKeys.folders(userId), context.previousFolders);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.folders(userId) });
    },
  });
}

export function useUpdateFolderMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async ({ folderId, patch }: { folderId: string; patch: Partial<Folder> }) => foldersRepository.patch(folderId, patch),
    onMutate: async ({ folderId, patch }) => {
      if (!userId) {
        return { previousFolders: undefined } satisfies FoldersSnapshot;
      }

      const queryKey = queryKeys.folders(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKey);

      queryClient.setQueryData<Folder[]>(queryKey, (current = []) =>
        sortFolders(current.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder))),
      );

      return { previousFolders } satisfies FoldersSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) {
        return;
      }

      queryClient.setQueryData(queryKeys.folders(userId), context.previousFolders);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.folders(userId) });
    },
  });
}

export function useDeleteFolderMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async (folderId: string) => foldersRepository.remove(folderId),
    onMutate: async (folderId) => {
      if (!userId) {
        return { previousFolders: undefined } satisfies FoldersSnapshot;
      }

      const queryKey = queryKeys.folders(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKey);

      queryClient.setQueryData<Folder[]>(queryKey, (current = []) => current.filter((folder) => folder.id !== folderId));

      return { previousFolders } satisfies FoldersSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) {
        return;
      }

      queryClient.setQueryData(queryKeys.folders(userId), context.previousFolders);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.folders(userId) });
    },
  });
}

export function useReorderFoldersMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: async (orderedFolderIds: string[]) => foldersRepository.reorder(orderedFolderIds),
    onMutate: async (orderedFolderIds) => {
      if (!userId) {
        return { previousFolders: undefined } satisfies FoldersSnapshot;
      }

      const queryKey = queryKeys.folders(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKey);
      const orderById = new Map(orderedFolderIds.map((folderId, folderOrder) => [folderId, folderOrder]));

      queryClient.setQueryData<Folder[]>(queryKey, (current = []) =>
        sortFolders(current.map((folder) => {
          const folderOrder = orderById.get(folder.id);

          return folderOrder === undefined ? folder : { ...folder, folderOrder };
        })),
      );

      return { previousFolders } satisfies FoldersSnapshot;
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context) {
        return;
      }

      queryClient.setQueryData(queryKeys.folders(userId), context.previousFolders);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.folders(userId) });
    },
  });
}

export function useFolderActions() {
  const createMutation = useCreateFolderMutation();
  const updateMutation = useUpdateFolderMutation();
  const deleteMutation = useDeleteFolderMutation();
  const reorderMutation = useReorderFoldersMutation();
  const folders = useFoldersQuery().data ?? [];

  function findFolder(folderId: string) {
    return folders.find((folder) => folder.id === folderId) ?? null;
  }

  return {
    addFolder: (draft: FolderDraft, ownerId: string) => {
      const nextOrder = folders.length ? Math.max(...folders.map((folder) => folder.folderOrder)) + 1 : 0;
      return createMutation.mutateAsync({ draft, ownerId, folderOrder: nextOrder });
    },
    patchFolder: (folderId: string, patch: Partial<Folder>) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch(patch) }),
    renameFolder: (folderId: string, name: string) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ name }) }),
    updateFolderDescription: (folderId: string, description: string | null) =>
      updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ description }) }),
    hideFolder: (folderId: string) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ isHidden: true }) }),
    unhideFolder: (folderId: string) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ isHidden: false }) }),
    trashFolder: (folderId: string) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ trashedAt: nowIso() }) }),
    restoreFolder: (folderId: string) => updateMutation.mutateAsync({ folderId, patch: normalizeFolderPatch({ trashedAt: null }) }),
    reorderFolders: (orderedFolderIds: string[]) => reorderMutation.mutateAsync(orderedFolderIds),
    moveFolder: (folderId: string, direction: -1 | 1) => {
      const visibleFolders = sortFolders(folders.filter((folder) => !folder.trashedAt));
      const currentIndex = visibleFolders.findIndex((folder) => folder.id === folderId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleFolders.length) {
        return Promise.resolve([]);
      }

      const nextFolders = [...visibleFolders];
      const [folder] = nextFolders.splice(currentIndex, 1);

      if (!folder) {
        return Promise.resolve([]);
      }

      nextFolders.splice(nextIndex, 0, folder);

      return reorderMutation.mutateAsync(nextFolders.map((item) => item.id));
    },
    permanentlyDeleteFolder: (folderId: string) => {
      const folder = findFolder(folderId);
      return folder ? deleteMutation.mutateAsync(folderId) : Promise.resolve();
    },
  };
}
