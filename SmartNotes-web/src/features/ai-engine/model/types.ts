import type { ResurfacingClass } from "@/entities/note";

export type AnalyzeNoteRequest = {
  noteId: string;
  title: string;
  content: string;
  userTags: string[];
  folderContext: Array<{ id: string; name: string; description: string | null }>;
  drawingDescriptions?: string[];
};

export type AnalyzeNoteResult = {
  folderId: string | null;
  userTags: string[];
  hiddenTags: string[];
  relevance: number;
  resurfacingClass: ResurfacingClass;
  promptVersion: string;
  summary?: string;
};

