import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";
import { clearSyncQueue, listSyncQueue, type SyncQueueItem } from "./sync-queue";
import { publish } from "../event-bus";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

type SyncResult = "success" | "failure";

async function processItem(item: SyncQueueItem, attempt = 1): Promise<SyncResult> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return "failure";
  }

  try {
    switch (item.entity) {
      case "note":
        await processNoteItem(supabase, item);
        break;
      case "folder":
        await processFolderItem(supabase, item);
        break;
      case "settings":
        await processSettingsItem(supabase, item);
        break;
    }

    return "success";
  } catch {
    if (attempt >= MAX_RETRIES) {
      publish("syncFailed", {
        message: `Sync failed after ${MAX_RETRIES} attempts: ${item.entity}/${item.operation} for ${item.id}`,
      });
      return "failure";
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return processItem(item, attempt + 1);
  }
}

async function processNoteItem(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  item: SyncQueueItem,
) {



  if (item.operation === "delete") {

    const { error } = await supabase.from("notes").delete().eq("id", item.id);
    if (error && error.code !== "PGRST116") throw error;
  }


}

async function processFolderItem(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  item: SyncQueueItem,
) {
  if (item.operation === "delete") {
    const { error } = await supabase.from("folders").delete().eq("id", item.id);
    if (error && error.code !== "PGRST116") throw error;
  }
}

async function processSettingsItem(
  _supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  _item: SyncQueueItem,
) {



}

let isProcessing = false;

export async function syncLocalMedia() {
  const { useAuthStore } = await import("@/features/auth/model/auth-store");
  const { isGuestUser } = await import("@/features/auth/lib/guest-session");
  const { status, user } = useAuthStore.getState();

  const isLocal = status === "degraded" || !user || user.id === "local-user" || isGuestUser(user);
  if (isLocal) return;

  const { notesRepository } = await import("@/features/notes/api/notes-repository");
  const notes = await notesRepository.listAll();

  const { getLocalMedia, deleteLocalMedia } = await import("@/shared/utils/local-media-db");
  const { SupabaseStorageProvider, GoogleDriveStorageProvider } = await import("@/features/notes/lib/storage-providers");

  const isGdriveDisabled = typeof window !== "undefined" && window.localStorage.getItem("smartnotes:disable-google-drive") === "true";
  const googleAuthUser = user as unknown as {
    app_metadata?: { provider?: string };
    identities?: Array<{ provider: string }>;
  } | null;
  const isGoogleUser = googleAuthUser?.app_metadata?.provider === "google" || googleAuthUser?.identities?.some((i) => i.provider === "google") || false;

  let didSync = false;

  for (const note of notes) {
    if (!note.media || note.media.length === 0) continue;

    const localMediaItems = note.media.filter((item) => item.provider === "local-inline");
    if (localMediaItems.length === 0) continue;

    const updatedMedia = [...note.media];
    let noteContent = note.content;
    const updatedPages = note.pages.map((p) => ({ ...p }));

    for (const item of localMediaItems) {
      try {
        const blob = await getLocalMedia(item.fileId);
        if (!blob) continue;

        const file = new File([blob], item.name || "image.jpg", { type: item.mimeType });

        const providers = [];
        if (!isGdriveDisabled) {
          providers.push(new GoogleDriveStorageProvider());
        }
        providers.push(new SupabaseStorageProvider());

        let newDescriptor = null;
        for (const provider of providers) {
          try {
            newDescriptor = await provider.upload(file, note.id);
            break;
          } catch (err) {
            console.warn(err);
          }
        }

        if (newDescriptor) {
          const idx = updatedMedia.findIndex((m) => m.id === item.id);
          if (idx !== -1) {
            updatedMedia[idx] = newDescriptor;
          }

          const localUrl = `local-media:${item.fileId}`;
          const cloudUrl = newDescriptor.url || "";

          noteContent = noteContent.replaceAll(localUrl, cloudUrl);
          for (const page of updatedPages) {
            if (page.content.includes(localUrl)) {
              page.content = page.content.replaceAll(localUrl, cloudUrl);
            }
          }

          await deleteLocalMedia(item.fileId);
          didSync = true;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (didSync) {
      await notesRepository.patch(note.id, {
        media: updatedMedia,
        content: noteContent,
        pages: updatedPages,
      });
    }
  }

  if (didSync) {
    publish("syncCompleted", { processedCount: 1, failedCount: 0 });
  }
}

export async function processSyncQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const items = listSyncQueue();

    if (items.length === 0) return;

    const failedIds = new Set<string>();

    for (const item of items) {
      const result = await processItem(item);
      if (result === "failure") {
        failedIds.add(item.id);
      }
    }

    if (failedIds.size === 0) {
      clearSyncQueue();
    } else {
      const remaining = items.filter((item) => failedIds.has(item.id));
      clearSyncQueue();
      for (const item of remaining) {
        const { createdAt: _createdAt, ...rest } = item;
        const { enqueueSyncItem } = await import("./sync-queue");
        enqueueSyncItem(rest);
      }
    }

    publish("syncCompleted", {
      processedCount: items.length - failedIds.size,
      failedCount: failedIds.size,
    });
  } finally {
    isProcessing = false;
  }
}

export function startSyncConsumer() {
  if (typeof window === "undefined") return;

  async function trySync() {
    if (navigator.onLine) {
      await processSyncQueue();
      await syncLocalMedia();
    }
  }

  window.addEventListener("online", () => {
    void trySync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void trySync();
    }
  });

  void trySync();
}
