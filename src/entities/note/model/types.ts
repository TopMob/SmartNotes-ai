import type { AccessRole, InviteStatus } from "@/entities/user";

export type AiStatus = "pending" | "analyzing" | "done" | "error";
export type ResurfacingClass = "task" | "idea" | "reference" | "archive";
export type DrawingTool = "pen" | "marker" | "eraser";

export type NoteLock = {
  v: number;
  hash: string;
  hidden: boolean;
};

export type NotePage = {
  id: string;
  title: string;
  content: string;
  drawingDataUrl: string | null;
  drawingRevision: number;
};

export type MediaDescriptor = {
  id: string;
  provider: "google-drive" | "local-inline";
  fileId: string;
  url: string | null;
  mimeType: string;
  name: string;
  size: number;
  thumbnailUrl: string | null;
};

export type NoteAccess = {
  userId: string;
  role: AccessRole;
  status: InviteStatus;
};

export type Note = {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  content: string;
  pages: NotePage[];
  userTags: string[];
  hiddenTags: string[];
  media: MediaDescriptor[];
  pinned: boolean;
  favorite: boolean;
  isArchived: boolean;
  reminderAt: string | null;
  lock: NoteLock | null;
  access: NoteAccess[];
  order: number;
  folderOrder: number | null;
  aiStatus: AiStatus;
  aiProcessed: boolean;
  analyzed: boolean;
  aiError: string | null;
  aiRelevance: number;
  resurfacingClass: ResurfacingClass | null;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
};

export type NoteDraft = Pick<Note, "title" | "content" | "folderId" | "userTags">;
