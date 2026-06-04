import type { MediaDescriptor } from "@/entities/note";
import { compressImage } from "@/shared/utils/image-compression";
import { setMediaDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import {
  GoogleDriveStorageProvider,
  SupabaseStorageProvider,
  IndexedDbStorageProvider,
  type StorageProvider
} from "./storage-providers";

export async function createLocalInlineMediaDescriptor(file: File): Promise<MediaDescriptor> {
  const provider = new IndexedDbStorageProvider();
  return provider.upload(file);
}

export async function uploadMediaFile(file: File, noteId: string, isGoogleUser?: boolean): Promise<MediaDescriptor> {
  const isGdriveDisabled = typeof window !== "undefined" && window.localStorage.getItem("smartnotes:disable-google-drive") === "true";

  const providers: StorageProvider[] = [];
  if (!isGdriveDisabled) {
    providers.push(new GoogleDriveStorageProvider());
  }
  providers.push(new SupabaseStorageProvider());
  providers.push(new IndexedDbStorageProvider());

  const compressionSetting = typeof window !== "undefined" ? window.localStorage.getItem("smartnotes:media-compression") || "medium" : "medium";

  for (const provider of providers) {
    try {
      let uploadFile = file;
      if (provider.name === "supabase") {
        if (compressionSetting === "low") {
          uploadFile = await compressImage(file, 800, 0.5);
        } else if (compressionSetting === "medium") {
          uploadFile = await compressImage(file, 1024, 0.65);
        } else if (compressionSetting === "high") {
          uploadFile = await compressImage(file, 1600, 0.85);
        } else if (compressionSetting === "original") {
          uploadFile = file;
        }
      }
      const descriptor = await provider.upload(uploadFile, noteId);
      
      setMediaDiagnostic({
        provider: provider.name,
        degraded: provider.name === "local-inline",
        message: `Successfully uploaded ${file.name} to ${provider.name}.`,
      });

      return descriptor;
    } catch (error) {
      console.warn(`Failed to upload to ${provider.name}, trying next provider:`, error);
      if (provider.name === "google-drive" && isGoogleUser) {
        throw error;
      }
    }
  }

  throw new Error("All upload providers failed");
}
