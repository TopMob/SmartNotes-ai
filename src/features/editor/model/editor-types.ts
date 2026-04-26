import type { NotePage } from "@/entities/note";

export type EditorSnapshot = {
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  pages: NotePage[];
};

export type EditorToolId = "bold" | "italic" | "underline" | "strike" | "bullets" | "numbered" | "hr" | "link" | "image" | "sketch" | "align" | "clear";
