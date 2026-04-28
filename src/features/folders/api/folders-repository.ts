import type { Folder, FolderDraft } from "@/entities/folder";
import { localFoldersRepository } from "@/features/folders/api/local-folders-repository";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";
import { createLocalFolder } from "@/features/folders/lib/folder-utils";

import { mapFolderDraftToInsert, mapFolderPatchToUpdate, mapFolderRow } from "./folder-mappers";

export type FoldersRepository = {
  list: () => Promise<Folder[]>;
  create: (draft: FolderDraft, ownerId: string, folderOrder: number) => Promise<Folder>;
  patch: (folderId: string, patch: Partial<Folder>) => Promise<Folder>;
  remove: (folderId: string) => Promise<void>;
};

export const foldersRepository: FoldersRepository = {
  async list() {
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
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.create(createLocalFolder(draft, ownerId, folderOrder));
    }

    const { data, error } = await supabase
      .from("folders")
      .insert(mapFolderDraftToInsert(draft, ownerId, folderOrder))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapFolderRow(data);
  },
  async patch(folderId, patch) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return localFoldersRepository.patch(folderId, patch);
    }

    const { data, error } = await supabase
      .from("folders")
      .update(mapFolderPatchToUpdate(patch))
      .eq("id", folderId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapFolderRow(data);
  },
  async remove(folderId) {
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
