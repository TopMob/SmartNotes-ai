import type { ResurfacingClass } from "@/entities/note";

export type AiMetadata = {
  noteId: string;
  promptVersion: string;
  aiError: string | null;
  relevanceDecayRate: number;
  embeddingModel: string | null;
  lastAnalyzedAt: string | null;
  hiddenTags: string[];
  relevance: number;
  resurfacingClass: ResurfacingClass | null;
};
