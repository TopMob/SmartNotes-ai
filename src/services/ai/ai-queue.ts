const pendingNoteIds = new Set<string>();

export function scheduleAiAnalysis(noteId: string) {
  pendingNoteIds.add(noteId);
}

export function listPendingAiAnalysis() {
  return [...pendingNoteIds];
}

export function markAiAnalysisDone(noteId: string) {
  pendingNoteIds.delete(noteId);
}
