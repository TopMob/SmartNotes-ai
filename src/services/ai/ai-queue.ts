




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

  }
}

const pendingNoteIds = new Set<string>(readPendingNoteIds());

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

  } catch {

  }
}

export function scheduleAiAnalysis(noteId: string) {
  pendingNoteIds.add(noteId);
  persistPendingNoteIds(pendingNoteIds);


  const existing = timers.get(noteId);
  if (existing) clearTimeout(existing);


  const timer = setTimeout(() => {
    timers.delete(noteId);
    void dispatchAnalysis(noteId);
  }, DEBOUNCE_MS);

  timers.set(noteId, timer);
}



export function listPendingAiAnalysis(): string[] {
  return [...pendingNoteIds];
}



export function clearAiAnalysisQueue() {
  pendingNoteIds.clear();
  persistPendingNoteIds(pendingNoteIds);
}
