import type { MediaDescriptor } from "@/entities/note";

import { createId } from "./note-utils";

export async function createLocalInlineMediaDescriptor(file: File): Promise<MediaDescriptor> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read local media file."));
    reader.readAsDataURL(file);
  });

  return {
    id: createId(),
    provider: "local-inline",
    fileId: createId(),
    url: dataUrl,
    mimeType: file.type || "application/octet-stream",
    name: file.name || "Upload",
    size: file.size,
    thumbnailUrl: file.type.startsWith("image/") ? dataUrl : null,
  };
}

export async function uploadMediaFile(file: File, noteId: string): Promise<MediaDescriptor> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("noteId", noteId);

  try {
    const response = await fetch("/api/media/google-drive/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      return (await response.json()) as MediaDescriptor;
    }
  } catch (error) {
    console.warn("Failed to upload via Google Drive proxy, falling back to local-inline:", error);
  }

  return createLocalInlineMediaDescriptor(file);
}
