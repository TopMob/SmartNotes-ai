import { publish } from "../event-bus";

export type SyncQueueItem = {
  id: string;
  entity: "note" | "folder" | "settings";
  operation: "create" | "patch" | "delete";
  payload: unknown;
  createdAt: string;
};

const SYNC_QUEUE_KEY = "smartnotes:sync:queue";

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readPersistedQueue() {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const value = window.localStorage.getItem(SYNC_QUEUE_KEY);
    return value ? (JSON.parse(value) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: SyncQueueItem[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    publish("syncFailed", { message: "Failed to persist sync queue locally." });
  }
}

const queue: SyncQueueItem[] = readPersistedQueue();

export function enqueueSyncItem(item: Omit<SyncQueueItem, "createdAt">) {
  const nextItem = { ...item, createdAt: new Date().toISOString() };
  const existingIndex = queue.findIndex((queued) => queued.id === item.id && queued.entity === item.entity && queued.operation === item.operation);

  if (existingIndex >= 0) {
    queue[existingIndex] = nextItem;
  } else {
    queue.push(nextItem);
  }

  persistQueue(queue);
  publish("syncQueued", { entity: item.entity, id: item.id });
}

export function listSyncQueue() {
  return [...queue];
}

export function clearSyncQueue() {
  queue.length = 0;
  persistQueue(queue);
}
