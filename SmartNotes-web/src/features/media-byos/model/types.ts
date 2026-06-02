export type ByosUploadState = "idle" | "requesting-permission" | "uploading" | "done" | "degraded" | "error";

export type ByosMediaInput = {
  file: File;
  noteId: string;
  pageId: string | null;
};
