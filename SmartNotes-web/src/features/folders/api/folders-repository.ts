import type { Folder, FolderDraft } from "@/entities/folder";
import { isGuestUser } from "@/features/auth/lib/guest-session";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { localFoldersRepository } from "@/features/folders/api/local-folders-repository";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";
import { createLocalFolder } from "@/features/folders/lib/folder-utils";

import { mapFolderDraftToInsert, mapFolderPatchToUpdate, mapFolderRow } from "./folder-mappers";

function shouldUseLocal(): boolean {
  const user = useAuthStore.getState().user;
  return !user || isGuestUser(user);
}

export type FoldersRepository = {
  list: () => Promise<Folder[]>;
  create: (draft: FolderDraft, ownerId: string, folderOrder: number) => Promise<Folder>;
  patch: (folderId: string, patch: Partial<Folder>) => Promise<Folder>;
  reorder: (orderedFolderIds: string[]) => Promise<Folder[]>;
  remove: (folderId: string) => Promise<void>;
};

export const foldersRepository: FoldersRepository = {
  async list() {
    if (shouldUseLocal()) {
      return localFoldersRepository.list();
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.list();
    }

    const { data, error } = await supabase.from("folders").select("*").order("folder_order", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(mapFolderRow);
  },
  async create(draft, ownerId, folderOrder) {
    if (shouldUseLocal()) {
      return localFoldersRepository.create(createLocalFolder(draft, ownerId, folderOrder));
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.create(createLocalFolder(draft, ownerId, folderOrder));
    }

    let embedding: string | null = null;
    try {
      const folderText = `${draft.name} ${draft.description || ""}`.trim();
      const { data: embedData } = await supabase.functions.invoke("embed", {
        body: { text: folderText, isFolder: true },
      });
      if (embedData && Array.isArray(embedData.embedding)) {
        embedding = JSON.stringify(embedData.embedding);
      }
    } catch (e) {
      console.warn("Failed to generate folder embedding on creation:", e);
    }

    const { data, error } = await supabase
      .from("folders")
      .insert(mapFolderDraftToInsert(draft, ownerId, folderOrder, embedding))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapFolderRow(data);
  },
  async patch(folderId, patch) {
    if (shouldUseLocal()) {
      return localFoldersRepository.patch(folderId, patch);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.patch(folderId, patch);
    }

    let updatedEmbedding: string | null | undefined = undefined;
    if (patch.name !== undefined || patch.description !== undefined) {
      try {
        const { data: currentFolder } = await supabase
          .from("folders")
          .select("name, description")
          .eq("id", folderId)
          .single();

        const finalName = patch.name !== undefined ? patch.name : (currentFolder?.name || "");
        const finalDesc = patch.description !== undefined ? patch.description : (currentFolder?.description || "");
        const folderText = `${finalName} ${finalDesc || ""}`.trim();

        const { data: embedData } = await supabase.functions.invoke("embed", {
          body: { text: folderText, isFolder: true },
        });
        if (embedData && Array.isArray(embedData.embedding)) {
          updatedEmbedding = JSON.stringify(embedData.embedding);
        }
      } catch (e) {
        console.warn("Failed to update folder embedding:", e);
      }
    }

    const updatePayload = mapFolderPatchToUpdate(patch);
    if (updatedEmbedding !== undefined) {
      updatePayload.embedding = updatedEmbedding;
    }

    const { data, error } = await supabase
      .from("folders")
      .update(updatePayload)
      .eq("id", folderId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapFolderRow(data);
  },
  async reorder(orderedFolderIds) {
    const updates = orderedFolderIds.map((folderId, folderOrder) => ({ folderId, folderOrder }));

    if (shouldUseLocal()) {
      return localFoldersRepository.reorder(updates);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.reorder(updates);
    }

    const folders = await Promise.all(updates.map(({ folderId, folderOrder }) => this.patch(folderId, { folderOrder })));

    return folders.sort((left, right) => left.folderOrder - right.folderOrder);
  },
  async remove(folderId) {
    if (shouldUseLocal()) {
      return localFoldersRepository.remove(folderId);
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.remove(folderId);
    }

    const { error } = await supabase.from("folders").delete().eq("id", folderId);

    if (error) {
      throw error;
    }
  },
};
