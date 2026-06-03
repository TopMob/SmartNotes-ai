import type { MediaDescriptor } from "@/entities/note";
import { storeLocalMedia, getLocalMedia, deleteLocalMedia } from "@/shared/utils/local-media-db";
import { createId } from "./note-utils";

export interface StorageProvider {
  name: "google-drive" | "supabase" | "local-inline";
  upload(file: File, noteId?: string): Promise<MediaDescriptor>;
  download(fileId: string): Promise<Blob | null>;
  delete(fileId: string): Promise<void>;
}

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = "google-drive";

  async upload(file: File, noteId?: string): Promise<MediaDescriptor> {
    const formData = new FormData();
    formData.append("file", file);
    if (noteId) {
      formData.append("noteId", noteId);
    }

    const response = await fetch("/api/media/google-drive/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed with status ${response.status}`);
    }

    return (await response.json()) as MediaDescriptor;
  }

  async download(): Promise<Blob | null> {
    return null;
  }

  async delete(): Promise<void> {}
}

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";

  async upload(file: File, noteId?: string): Promise<MediaDescriptor> {
    const { useAuthStore } = await import("@/features/auth/model/auth-store");
    const user = useAuthStore.getState().user;
    const userId = user?.id;

    if (!userId || userId === "local-user" || userId.startsWith("guest-")) {
      throw new Error("User not authenticated for Supabase upload");
    }

    const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase client is not available");
    }

    const fileExt = file.name.split(".").pop() || "jpg";
    const randomName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${userId}/${randomName}`;

    const { error } = await supabase.storage
      .from("note-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("note-images")
      .getPublicUrl(filePath);

    return {
      id: createId(),
      provider: "supabase",
      fileId: randomName,
      url: publicUrl,
      mimeType: file.type || "application/octet-stream",
      name: file.name || "Upload",
      size: file.size,
      thumbnailUrl: file.type.startsWith("image/") ? publicUrl : null,
    };
  }

  async download(fileId: string): Promise<Blob | null> {
    const { useAuthStore } = await import("@/features/auth/model/auth-store");
    const user = useAuthStore.getState().user;
    const userId = user?.id;
    if (!userId) return null;

    const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return null;

    const filePath = `${userId}/${fileId}`;
    const { data, error } = await supabase.storage
      .from("note-images")
      .download(filePath);

    if (error || !data) return null;
    return data;
  }

  async delete(fileId: string): Promise<void> {
    const { useAuthStore } = await import("@/features/auth/model/auth-store");
    const user = useAuthStore.getState().user;
    const userId = user?.id;
    if (!userId) return;

    const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const filePath = `${userId}/${fileId}`;
    await supabase.storage.from("note-images").remove([filePath]);
  }
}

export class IndexedDbStorageProvider implements StorageProvider {
  readonly name = "local-inline";

  async upload(file: File, noteId?: string): Promise<MediaDescriptor> {
    const fileId = createId();
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

  async download(fileId: string): Promise<Blob | null> {
    return getLocalMedia(fileId);
  }

  async delete(fileId: string): Promise<void> {
    await deleteLocalMedia(fileId);
  }
}
