// ---------------------------------------------------------------------------
// AI Analysis Queue — debounced dispatch to /api/ai/analyze
// Spec: SmartNotes_Features.txt §10 AI ENGINE
// ---------------------------------------------------------------------------

const AI_QUEUE_KEY = "smartnotes:ai:pending";
const DEBOUNCE_MS = 3_000;

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
    // ignore
  }
}

const pendingNoteIds = new Set<string>(readPendingNoteIds());
// Per-note debounce timers
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function dispatchAnalysis(noteId: string): Promise<void> {
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });

    if (response.ok) {
      pendingNoteIds.delete(noteId);
      persistPendingNoteIds(pendingNoteIds);
    }
    // On non-ok: leave in pending so it can be retried
  } catch {
    // Network error — leave in pending
  }
}

export function scheduleAiAnalysis(noteId: string) {
  pendingNoteIds.add(noteId);
  persistPendingNoteIds(pendingNoteIds);

  // Cancel any existing timer for this note
  const existing = timers.get(noteId);
  if (existing) clearTimeout(existing);

  // Schedule new debounced dispatch
  const timer = setTimeout(() => {
    timers.delete(noteId);
    void dispatchAnalysis(noteId);
  }, DEBOUNCE_MS);

  timers.set(noteId, timer);
}

export function cancelAiAnalysis(noteId: string): void {
  const timer = timers.get(noteId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(noteId);
  }
  pendingNoteIds.delete(noteId);
  persistPendingNoteIds(pendingNoteIds);
}

export function listPendingAiAnalysis(): string[] {
  return [...pendingNoteIds];
}

export function markAiAnalysisDone(noteId: string): void {
  pendingNoteIds.delete(noteId);
  persistPendingNoteIds(pendingNoteIds);
}

export function clearAiAnalysisQueue() {
  pendingNoteIds.clear();
  persistPendingNoteIds(pendingNoteIds);
}
