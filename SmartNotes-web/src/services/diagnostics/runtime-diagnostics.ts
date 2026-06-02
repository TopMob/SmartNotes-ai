type CollabDiagnostic = {
  noteId: string;
  status: "hydrating" | "ready" | "error";
  hydratedFromQuery: boolean;
  transport: "idle" | "connected" | "error";
  persistence: "idle" | "synced" | "error";
  durable: "idle" | "saving" | "saved" | "error";
  updatedAt: string;
  message: string | null;
};

type MediaDiagnostic = {
  provider: "google-drive" | "local-inline" | "supabase";
  degraded: boolean;
  updatedAt: string;
  message: string;
};

const collabByNoteId = new Map<string, CollabDiagnostic>();
let mediaDiagnostic: MediaDiagnostic = {
  provider: "google-drive",
  degraded: false,
  updatedAt: new Date(0).toISOString(),
  message: "No media activity yet.",
};

export function setCollabDiagnostic(noteId: string, diagnostic: Omit<CollabDiagnostic, "noteId" | "updatedAt">) {
  collabByNoteId.set(noteId, {
    noteId,
    updatedAt: new Date().toISOString(),
    ...diagnostic,
  });
}

export function clearCollabDiagnostic(noteId: string) {
  collabByNoteId.delete(noteId);
}

export function listCollabDiagnostics() {
  return [...collabByNoteId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function setMediaDiagnostic(diagnostic: Omit<MediaDiagnostic, "updatedAt">) {
  mediaDiagnostic = {
    updatedAt: new Date().toISOString(),
    ...diagnostic,
  };
}

export function getMediaDiagnostic() {
  return mediaDiagnostic;
}
