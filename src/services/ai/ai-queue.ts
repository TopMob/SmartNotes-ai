import { publish } from "../event-bus";

const AI_QUEUE_KEY = "smartnotes:ai:pending";

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readPendingNoteIds(): string[] {
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
    // Silent catch
  }
}

const pendingNoteIds = new Set<string>(readPendingNoteIds());
let isProcessing = false;

export function scheduleAiAnalysis(noteId: string) {
  if (!noteId) return;
  pendingNoteIds.add(noteId);
  persistPendingNoteIds(pendingNoteIds);
  void processAiQueue();
}

export function listPendingAiAnalysis(): string[] {
  return [...pendingNoteIds];
}

export function clearAiAnalysisQueue() {
  pendingNoteIds.clear();
  persistPendingNoteIds(pendingNoteIds);
}

async function processNoteAnalysis(noteId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ noteId }),
    });

    return response.ok;
  } catch (error) {
    console.error("AI analysis failed in background for note:", noteId, error);
    return false;
  }
}

export async function processAiQueue() {
  if (isProcessing) return;
  if (pendingNoteIds.size === 0) return;

  if (typeof window !== "undefined" && !navigator.onLine) {
    return; // offline, wait for network
  }

  isProcessing = true;

  try {
    const idsToProcess = [...pendingNoteIds];
    for (const noteId of idsToProcess) {
      // Check if user went offline during the run
      if (typeof window !== "undefined" && !navigator.onLine) {
        break;
      }

      const success = await processNoteAnalysis(noteId);
      if (success) {
        pendingNoteIds.delete(noteId);
        persistPendingNoteIds(pendingNoteIds);
        
        // Notify data layers to invalidate notes query and toast user
        publish("syncCompleted", { processedCount: 1, failedCount: 0 });
      } else {
        console.warn("Background AI analysis retry failed for:", noteId);
      }

      // 1.5s delay to prevent API overloading and rate limit triggers
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } finally {
    isProcessing = false;
  }
}

export function startBackgroundAiScheduler() {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    void processAiQueue();
  });

  void processAiQueue();
}

