import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

let channels: RealtimeChannel[] = [];
let queryClientRef: import("@tanstack/react-query").QueryClient | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const pendingInvalidations = new Set<string>();

function flushInvalidations() {
  if (!queryClientRef) return;
  const toInvalidate = Array.from(pendingInvalidations);
  pendingInvalidations.clear();

  toInvalidate.forEach((key) => {
    void queryClientRef!.invalidateQueries({
      predicate: (query) => query.queryKey[0] === key,
    });
  });
}

function queueInvalidation(key: string) {
  pendingInvalidations.add(key);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushInvalidations, 500);
}

function handleNoteChange(payload: ChangePayload) {
  if (!queryClientRef) return;
  queueInvalidation("notes");
  
  const record = (payload as any).new || (payload as any).old;
  if (record && typeof record === "object" && "id" in record) {
    // Invalidate the specific note detail query as well
    void queryClientRef.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "note-detail" && query.queryKey[2] === record.id,
    });
  }
}

function handleFolderChange(_payload: ChangePayload) {
  queueInvalidation("folders");
}

function handleSettingsChange(_payload: ChangePayload) {
  queueInvalidation("settings");
}

function handleInviteChange(_payload: ChangePayload) {
  queueInvalidation("invites");
  queueInvalidation("notes");
}

function handleAccessChange(_payload: ChangePayload) {
  queueInvalidation("notes");
}

function onChannelStatus(status: string) {
  if (status === 'SUBSCRIBED') {
    // Refetch everything when we (re)connect to catch any missed updates while disconnected
    queueInvalidation("notes");
    queueInvalidation("folders");
    queueInvalidation("settings");
    queueInvalidation("invites");
  }
}

export function startRealtimeSubscriptions(queryClient: import("@tanstack/react-query").QueryClient) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) return;

  queryClientRef = queryClient;

  stopRealtimeSubscriptions(supabase);

  const notesChannel = supabase
    .channel("realtime:notes")
    .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, handleNoteChange)
    .subscribe(onChannelStatus);

  const foldersChannel = supabase
    .channel("realtime:folders")
    .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, handleFolderChange)
    .subscribe();

  const settingsChannel = supabase
    .channel("realtime:settings")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_settings" }, handleSettingsChange)
    .subscribe();

  const invitesChannel = supabase
    .channel("realtime:note_invites")
    .on("postgres_changes", { event: "*", schema: "public", table: "note_invites" }, handleInviteChange)
    .subscribe();

  const accessChannel = supabase
    .channel("realtime:note_access")
    .on("postgres_changes", { event: "*", schema: "public", table: "note_access" }, handleAccessChange)
    .subscribe();

  channels = [notesChannel, foldersChannel, settingsChannel, invitesChannel, accessChannel];
}

export function stopRealtimeSubscriptions(supabase?: ReturnType<typeof createSupabaseBrowserClient>) {
  if (debounceTimer) clearTimeout(debounceTimer);
  
  if (!supabase && channels.length > 0) {
    supabase = createSupabaseBrowserClient();
  }

  if (supabase) {
    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
  }

  channels = [];
  queryClientRef = null;
}

