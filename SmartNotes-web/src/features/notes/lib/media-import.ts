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
  const compressedFile = await compressImage(file);
  const isGdriveDisabled = typeof window !== "undefined" && window.localStorage.getItem("smartnotes:disable-google-drive") === "true";

  const providers: StorageProvider[] = [];
  if (!isGdriveDisabled) {
    providers.push(new GoogleDriveStorageProvider());
  }
  providers.push(new SupabaseStorageProvider());
  providers.push(new IndexedDbStorageProvider());

  for (const provider of providers) {
    try {
      const descriptor = await provider.upload(compressedFile, noteId);
      
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
