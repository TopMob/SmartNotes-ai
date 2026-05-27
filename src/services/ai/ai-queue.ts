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

export function scheduleAiAnalysis(_noteId: string) {
  // Temporarily disabled as requested
  return;
}

export function listPendingAiAnalysis(): string[] {
  return [...pendingNoteIds];
}

export function clearAiAnalysisQueue() {
  pendingNoteIds.clear();
  persistPendingNoteIds(pendingNoteIds);
}
