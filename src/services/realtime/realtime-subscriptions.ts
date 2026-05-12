import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

let channels: RealtimeChannel[] = [];
let queryClientRef: import("@tanstack/react-query").QueryClient | null = null;

function handleNoteChange(_payload: ChangePayload) {
  if (!queryClientRef) return;


  void queryClientRef.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return key === "notes";
    },
  });
}

function handleFolderChange(_payload: ChangePayload) {
  if (!queryClientRef) return;

  void queryClientRef.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return key === "folders";
    },
  });
}

function handleSettingsChange(_payload: ChangePayload) {
  if (!queryClientRef) return;

  void queryClientRef.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return key === "settings";
    },
  });
}

export function startRealtimeSubscriptions(queryClient: import("@tanstack/react-query").QueryClient) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) return;

  queryClientRef = queryClient;


  stopRealtimeSubscriptions(supabase);

  const notesChannel = supabase
    .channel("realtime:notes")
    .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, handleNoteChange)
    .subscribe();

  const foldersChannel = supabase
    .channel("realtime:folders")
    .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, handleFolderChange)
    .subscribe();

  const settingsChannel = supabase
    .channel("realtime:settings")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_settings" }, handleSettingsChange)
    .subscribe();

  channels = [notesChannel, foldersChannel, settingsChannel];
}

export function stopRealtimeSubscriptions(supabase?: ReturnType<typeof createSupabaseBrowserClient>) {
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
