import { publish } from "../event-bus";

export type SyncQueueItem = {
  id: string;
  entity: "note" | "folder" | "settings";
  operation: "create" | "patch" | "delete";
  payload: unknown;
  createdAt: string;
};

const queue: SyncQueueItem[] = [];

export function enqueueSyncItem(item: Omit<SyncQueueItem, "createdAt">) {
  queue.push({ ...item, createdAt: new Date().toISOString() });
  publish("syncQueued", { entity: item.entity, id: item.id });
}

export function listSyncQueue() {
  return [...queue];
}

export function clearSyncQueue() {
  queue.length = 0;
}
