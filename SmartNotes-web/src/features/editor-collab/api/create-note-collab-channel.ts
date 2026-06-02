"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

import { NOTE_COLLAB_CHANNEL_PREFIX } from "../lib/note-collab-constants";

export function createNoteCollabChannel(noteId: string): RealtimeChannel | null {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  return supabase.channel(`${NOTE_COLLAB_CHANNEL_PREFIX}:${noteId}`, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: noteId },
    },
  });
}
