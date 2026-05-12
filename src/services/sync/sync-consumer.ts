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
  } catch (error) {
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
        const { createdAt, ...rest } = item;

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
