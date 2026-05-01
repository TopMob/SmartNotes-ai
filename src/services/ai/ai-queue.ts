// ---------------------------------------------------------------------------
// AI Analysis Queue — debounced dispatch to /api/ai/analyze
// Spec: SmartNotes_Features.txt §10 AI ENGINE
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 3_000;
const STORAGE_KEY = "sn_ai_pending_ids";

// In-memory set of noteIds waiting for analysis
const pendingNoteIds = new Set<string>();
// Per-note debounce timers
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// ---- Persistence helpers ----
function loadPersistedIds(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      ids.forEach((id) => pendingNoteIds.add(id));
    }
  } catch {
    // ignore
  }
}

function persistIds(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pendingNoteIds]));
  } catch {
    // ignore
  }
}

// Load on module init (browser only)
if (typeof window !== "undefined") {
  loadPersistedIds();
}

async function dispatchAnalysis(noteId: string): Promise<void> {
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });

    if (response.ok) {
      pendingNoteIds.delete(noteId);
      persistIds();
    }
    // On non-ok: leave in pending so it can be retried
  } catch {
    // Network error — leave in pending
  }
}

export function scheduleAiAnalysis(noteId: string): void {
  pendingNoteIds.add(noteId);
  persistIds();

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
  persistIds();
}

export function listPendingAiAnalysis(): string[] {
  return [...pendingNoteIds];
}

export function markAiAnalysisDone(noteId: string): void {
  pendingNoteIds.delete(noteId);
  persistIds();
}
