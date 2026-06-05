



import type { AnalyzeNoteRequest, AnalyzeNoteResult } from "@/features/ai-engine/model/types";
import { openRouterComplete } from "@/shared/api/openrouter/openrouter-client";
import { stripHtml } from "@/shared/utils/string";

const PROMPT_VERSION = "v1.0";

const SYSTEM_PROMPT = `You are a smart note classification AI for the SmartNotes app.
Your job is to analyze a note and return a JSON object with the following fields:
- userTags: string[] - 2 to 5 short, lowercase, visible hashtags relevant to the note content
- hiddenTags: string[] - 3 to 8 semantic concepts for internal search and retrieval (can be longer phrases)
- folderId: string | null - the best matching folder ID from the provided list, or null if none fit
- relevance: number - importance/usefulness score between 0 and 1 (0 = trivial/archive, 1 = critical)
- resurfacingClass: "task" | "idea" | "reference" | "archive" - how this note should resurface over time
- summary: string - a brief 1-2 sentence summary of the note, in the language of the note, highlighting key takeaways

Rules:
- Respond ONLY with valid JSON, no markdown, no explanation
- userTags must be lowercase, single words or short hyphenated phrases
- hiddenTags can include abstract concepts, synonyms, related domains
- If no folder matches well, return null for folderId
- Be concise and precise`;



function chunkText(text: string, maxChars = 4000): string {
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

function buildUserPrompt(request: AnalyzeNoteRequest): string {
  const content = chunkText(stripHtml(request.content));
  const folderList =
    request.folderContext.length > 0
      ? request.folderContext
          .map((f) => `- id="${f.id}" name="${f.name}"${f.description ? ` desc="${f.description.slice(0, 80)}"` : ""}`)
          .join("\n")
      : "No folders available.";

  const drawings =
    request.drawingDescriptions && request.drawingDescriptions.length > 0
      ? `\nDrawing descriptions:\n${request.drawingDescriptions.map((d) => `- ${d}`).join("\n")}`
      : "";

  return `Note title: ${request.title || "(no title)"}
Note content: ${content || "(empty)"}${drawings}

Available folders:
${folderList}`;
}

function safeParseResult(raw: string): Partial<AnalyzeNoteResult> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      userTags: Array.isArray(parsed.userTags)
        ? (parsed.userTags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 8)
        : [],
      hiddenTags: Array.isArray(parsed.hiddenTags)
        ? (parsed.hiddenTags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 15)
        : [],
      folderId: typeof parsed.folderId === "string" ? parsed.folderId : null,
      relevance:
        typeof parsed.relevance === "number" && parsed.relevance >= 0 && parsed.relevance <= 1
          ? parsed.relevance
          : 0.5,
      resurfacingClass:
        ["task", "idea", "reference", "archive"].includes(parsed.resurfacingClass as string)
          ? (parsed.resurfacingClass as AnalyzeNoteResult["resurfacingClass"])
          : "reference",
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    };
  } catch {
    return {};
  }
}

export async function analyzeNote(request: AnalyzeNoteRequest): Promise<AnalyzeNoteResult> {
  const userPrompt = buildUserPrompt(request);
  const raw = await openRouterComplete(SYSTEM_PROMPT, userPrompt);
  const parsed = safeParseResult(raw);

  return {
    userTags: parsed.userTags ?? [],
    hiddenTags: parsed.hiddenTags ?? [],
    folderId: parsed.folderId ?? null,
    relevance: parsed.relevance ?? 0.5,
    resurfacingClass: parsed.resurfacingClass ?? "reference",
    promptVersion: PROMPT_VERSION,
    summary: parsed.summary,
  };
}
