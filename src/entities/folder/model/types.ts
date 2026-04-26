import type { AccessRole } from "@/entities/user";

export type Folder = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  isHidden: boolean;
  isArchived: boolean;
  folderOrder: number;
  accessRole: AccessRole;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
};

export type FolderDraft = Pick<Folder, "name" | "description" | "isHidden">;
