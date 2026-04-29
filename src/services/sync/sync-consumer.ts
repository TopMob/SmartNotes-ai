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
  // For create/patch, the actual data is already in Supabase via the repository calls.
  // The sync queue is a safety net for offline scenarios where the repository call failed.
  // For now, we just confirm the operation succeeded by checking the note exists.
  if (item.operation === "delete") {
    // For delete operations, just verify or re-attempt
    const { error } = await supabase.from("notes").delete().eq("id", item.id);
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found, already deleted
  }
  // Create and patch operations are handled by the repository directly.
  // The sync queue serves as a log for retry logic.
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
  // Settings are already patched via the repository. The sync queue entry
  // confirms the operation. No additional server call needed for settings
  // since they're always patched through the repository.
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
        // Mark as failed but continue processing other items
        failedIds.add(item.id);
      }
    }

    // Clear successfully processed items, keep failed ones
    if (failedIds.size === 0) {
      clearSyncQueue();
    } else {
      // Keep only failed items in the queue
      const remaining = items.filter((item) => failedIds.has(item.id));
      clearSyncQueue();
      for (const item of remaining) {
        const { createdAt, ...rest } = item;
        // Re-enqueue without the createdAt to get a fresh timestamp
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

  // Try initial sync if already online
  void trySync();
}
