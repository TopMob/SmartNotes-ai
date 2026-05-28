import type { MediaDescriptor } from "@/entities/note";
import { compressImage } from "@/shared/utils/image-compression";
import { setMediaDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { createId } from "./note-utils";

import { storeLocalMedia } from "@/shared/utils/local-media-db";

export async function createLocalInlineMediaDescriptor(file: File): Promise<MediaDescriptor> {
  const fileId = createId();
  
  // Store compressed File (Blob) in IndexedDB under the unique fileId key
  await storeLocalMedia(fileId, file);

  const localUrl = `local-media:${fileId}`;

  return {
    id: createId(),
    provider: "local-inline",
    fileId,
    url: localUrl,
    mimeType: file.type || "application/octet-stream",
    name: file.name || "Upload",
    size: file.size,
    thumbnailUrl: file.type.startsWith("image/") ? localUrl : null,
  };
}

export async function uploadMediaFile(file: File, noteId: string, isGoogleUser?: boolean): Promise<MediaDescriptor> {
  // 1. Compress image client-side before uploading (aims for under 500KB)
  const compressedFile = await compressImage(file);

  const isGdriveDisabled = typeof window !== "undefined" && window.localStorage.getItem("smartnotes:disable-google-drive") === "true";

  // Attempt Google Drive upload if not explicitly disabled by the user
  if (!isGdriveDisabled) {
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("noteId", noteId);

    try {
      const response = await fetch("/api/media/google-drive/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setMediaDiagnostic({
          provider: "google-drive",
          degraded: false,
          message: `Successfully uploaded ${file.name} to Google Drive.`,
        });
        return (await response.json()) as MediaDescriptor;
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to upload via Google Drive proxy, trying Supabase Storage:", error);
      if (isGoogleUser) {
        throw error;
      }
    }
  }

  // 2. Upload to Supabase Storage (Object Storage) if user is authenticated
  try {
    const { useAuthStore } = await import("@/features/auth/model/auth-store");
    const user = useAuthStore.getState().user;
    const userId = user?.id;

    if (userId && userId !== "local-user" && !userId.startsWith("guest-")) {
      const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
      const supabase = createSupabaseBrowserClient();

      if (supabase) {
        const fileExt = compressedFile.name.split(".").pop() || "jpg";
        const randomName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${userId}/${randomName}`;

        const { data, error } = await supabase.storage
          .from("note-images")
          .upload(filePath, compressedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("note-images")
          .getPublicUrl(filePath);

        setMediaDiagnostic({
          provider: "supabase",
          degraded: false,
          message: `Successfully uploaded ${file.name} to Supabase Storage.`,
        });

        return {
          id: createId(),
          provider: "supabase",
          fileId: randomName,
          url: publicUrl,
          mimeType: compressedFile.type || "application/octet-stream",
          name: compressedFile.name || "Upload",
          size: compressedFile.size,
          thumbnailUrl: compressedFile.type.startsWith("image/") ? publicUrl : null,
        };
      }
    }
  } catch (error) {
    console.error("Failed to upload to Supabase Storage, falling back to local-inline:", error);
  }

  // 3. Ultimate fallback: store image offline/locally as inline Base64 descriptor
  setMediaDiagnostic({
    provider: "local-inline",
    degraded: true,
    message: `Stored image locally inline as Base64.`,
  });

  return createLocalInlineMediaDescriptor(compressedFile);
}

