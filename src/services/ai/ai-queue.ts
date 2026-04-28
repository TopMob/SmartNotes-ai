const AI_QUEUE_KEY = "smartnotes:ai:pending";

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readPendingNoteIds() {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const value = window.localStorage.getItem(AI_QUEUE_KEY);
    return value ? (JSON.parse(value) as string[]).filter((item) => typeof item === "string") : [];
  } catch {
    return;
    return [];
  }
}

function persistPendingNoteIds(noteIds: Set<string>) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(AI_QUEUE_KEY, JSON.stringify([...noteIds]));
  } catch {
  }
}

const pendingNoteIds = new Set<string>(readPendingNoteIds());

export function scheduleAiAnalysis(noteId: string) {
  pendingNoteIds.add(noteId);
  persistPendingNoteIds(pendingNoteIds);
}

export function listPendingAiAnalysis() {
  return [...pendingNoteIds];
}

export function markAiAnalysisDone(noteId: string) {
  pendingNoteIds.delete(noteId);
  persistPendingNoteIds(pendingNoteIds);
}

export function clearAiAnalysisQueue() {
  pendingNoteIds.clear();
  persistPendingNoteIds(pendingNoteIds);
}
