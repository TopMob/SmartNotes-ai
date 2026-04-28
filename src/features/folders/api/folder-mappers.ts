import type { Folder, FolderDraft } from "@/entities/folder";
import type { Database } from "@/shared/api/supabase/types";

type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

export function mapFolderRow(row: FolderRow): Folder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    isHidden: row.is_hidden,
    isArchived: row.is_archived,
    folderOrder: row.folder_order,
    accessRole: row.access_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trashedAt: row.trashed_at,
  };
}

export function mapFolderDraftToInsert(draft: FolderDraft, ownerId: string, folderOrder: number): FolderInsert {
  return {
    owner_id: ownerId,
    name: draft.name.trim() || "Новая папка",
    description: draft.description,
    is_hidden: draft.isHidden,
    is_archived: false,
    folder_order: folderOrder,
    access_role: "owner",
  };
}

export function mapFolderPatchToUpdate(patch: Partial<Folder>): FolderUpdate {
  return {
    owner_id: patch.ownerId,
    name: patch.name,
    description: patch.description,
    is_hidden: patch.isHidden,
    is_archived: patch.isArchived,
    folder_order: patch.folderOrder,
    access_role: patch.accessRole,
    created_at: patch.createdAt,
    updated_at: patch.updatedAt,
    trashed_at: patch.trashedAt,
  };
}
