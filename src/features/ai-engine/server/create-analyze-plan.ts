import type { AnalyzeNoteRequest } from "../model/types";

export function createAnalyzePlan(request: AnalyzeNoteRequest) {
  return {
    noteId: request.noteId,
    stages: ["extract", "chunk", "embed", "classify", "route-folder", "rank", "persist"],
    folderCandidates: request.folderContext.map((folder) => folder.id),
    hasVisionInput: Boolean(request.drawingDescriptions?.length),
    promptVersion: "semantic-vector-v1",
  };
}
