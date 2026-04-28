"use client";

import * as Y from "yjs";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { NOTE_COLLAB_PRESENCE_EVENT, NOTE_COLLAB_UPDATE_EVENT } from "./note-collab-constants";
import { decodeYjsUpdate, encodeYjsUpdate } from "./yjs-update-encoding";

type BindYjsSupabaseChannelOptions = {
  noteId: string;
  channel: RealtimeChannel;
  doc: Y.Doc;
};

export function bindYjsSupabaseChannel({ noteId, channel, doc }: BindYjsSupabaseChannelOptions) {
  let disposed = false;
  let subscribed = false;

  const handleUpdate = (update: Uint8Array, origin: unknown) => {
    if (disposed || origin === channel) {
      return;
    }

    void channel.send({
      type: "broadcast",
      event: NOTE_COLLAB_UPDATE_EVENT,
      payload: {
        noteId,
        update: encodeYjsUpdate(update),
      },
    });
  };

  const handleBroadcast = ({ payload }: { payload: { noteId?: string; update?: string } }) => {
    if (disposed || payload.noteId !== noteId || !payload.update) {
      return;
    }

    Y.applyUpdate(doc, decodeYjsUpdate(payload.update), channel);
  };

  channel.on("broadcast", { event: NOTE_COLLAB_UPDATE_EVENT }, handleBroadcast);

  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED" || subscribed) {
      return;
    }

    subscribed = true;
    void channel.track({ noteId, at: new Date().toISOString(), event: NOTE_COLLAB_PRESENCE_EVENT });
  });

  doc.on("update", handleUpdate);

  return {
    destroy() {
      disposed = true;
      doc.off("update", handleUpdate);
      channel.unsubscribe();
    },
  };
}
