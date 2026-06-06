"use client";

import * as Y from "yjs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { z } from "zod";

import { NOTE_COLLAB_PRESENCE_EVENT, NOTE_COLLAB_UPDATE_EVENT } from "./note-collab-constants";
import { decodeYjsUpdate, encodeYjsUpdate } from "./yjs-update-encoding";

const DocumentSchema = z.object({
  title: z.string().max(1000).optional(),
  folderId: z.string().nullable().optional(),
  userTags: z.array(z.string()).optional(),
  pages: z.array(z.any()).optional(),
}).strict().passthrough(); // Using passthrough/any to tolerate partial sync states while preventing complete blowups, ideally this matches YNoteDocSnapshot perfectly

type Options = {
  noteId: string;
  channel: RealtimeChannel;
  doc: Y.Doc;
};

export function bindYjsSupabaseChannel({ noteId, channel, doc }: Options) {
  let disposed = false;
  let subscribed = false;
  const pending: Uint8Array[] = [];

  function flush() {
    if (!pending.length) return;
    const merged = Y.mergeUpdates(pending);
    pending.length = 0;
    void channel.send({
      type: "broadcast",
      event: NOTE_COLLAB_UPDATE_EVENT,
      payload: { noteId, update: encodeYjsUpdate(merged) },
    });
  }

  const handleUpdate = (update: Uint8Array, origin: unknown) => {
    if (disposed || origin === channel) return;
    if (!subscribed) { pending.push(update); return; }
    void channel.send({
      type: "broadcast",
      event: NOTE_COLLAB_UPDATE_EVENT,
      payload: { noteId, update: encodeYjsUpdate(update) },
    });
  };

  const handleBroadcast = ({ payload }: { payload: { noteId?: string; update?: string } }) => {
    if (disposed || payload.noteId !== noteId || !payload.update) return;

    try {
      const incomingUpdate = decodeYjsUpdate(payload.update);
      const sandboxDoc = new Y.Doc();
      const serverState = Y.encodeStateAsUpdate(doc);

      Y.applyUpdate(sandboxDoc, serverState);
      Y.applyUpdate(sandboxDoc, incomingUpdate);

      const jsonState = sandboxDoc.getMap('smartnotes:collab:root').toJSON();
      DocumentSchema.parse(jsonState);

      Y.applyUpdate(doc, incomingUpdate, channel);
    } catch (error) {
      console.error("Malicious or malformed CRDT update detected", error);
    }
  };

  channel.on("broadcast", { event: NOTE_COLLAB_UPDATE_EVENT }, handleBroadcast);

  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED" || subscribed) return;
    subscribed = true;
    void channel.track({ noteId, at: new Date().toISOString(), event: NOTE_COLLAB_PRESENCE_EVENT });
    flush();
  });

  doc.on("update", handleUpdate);

  return {
    destroy() {
      disposed = true;
      pending.length = 0;
      doc.off("update", handleUpdate);
      channel.unsubscribe();
    },
  };
}
