import type { Note, ResurfacingClass } from "@/entities/note";

export type AiAction =
  | {
      type: "createFolder";
      folderName: string;
      tempId: string;
    }
  | {
      type: "moveNotesToFolder";
      folderId?: string | null;
      folderName?: string;
      tempId?: string;
      noteIds: string[];
    }
  | {
      type: "addTagsToNotes";
      noteIds: string[];
      tags: string[];
    }
  | {
      type: "createStructuredIdeaNote";
      title: string;
      sourceText: string;
      summary: string;
      keyIdeas: string[];
      nextSteps: string[];
      tags: string[];
      saveMode: "ai_only" | "human_plus_ai";
      openAfterSave?: boolean;
    };

export type AiActionExecutionResult = {
  index: number;
  type: AiAction["type"];
  success: boolean;
  message: string;
  createdFolderId?: string;
  createdNoteId?: string;
  affectedNoteIds?: string[];
};

export type ValidatedAiResponse = {
  answer: string;
  actions: AiAction[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return strings.length ? strings : [];
}

export function isCaptureIntent(question: string) {
  const normalized = question.toLowerCase();

  return [
    "сохрани мысл",
    "создай заметку",
    "оформи мысл",
    "capture",
    "save this thought",
    "turn this into a note",
    "structure this thought",
  ].some((token) => normalized.includes(token));
}

export function buildStructuredIdeaNoteContent(input: {
  title: string;
  sourceText: string;
  summary: string;
  keyIdeas: string[];
  nextSteps: string[];
  tags: string[];
  saveMode: "ai_only" | "human_plus_ai";
}) {
  const title = input.title.trim() || "Untitled idea";
  const summary = input.summary.trim();
  const keyIdeas = input.keyIdeas.filter(Boolean);
  const nextSteps = input.nextSteps.filter(Boolean);
  const tags = input.tags.filter(Boolean).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  const sections: string[] = [`# ${title}`, ""];

  if (input.saveMode === "human_plus_ai") {
    sections.push("## Original thought", input.sourceText.trim(), "", "---", "");
  }

  sections.push("## Structured by AI", "### Summary", summary || "-", "", "### Key ideas");
  sections.push(...(keyIdeas.length ? keyIdeas.map((item) => `- ${item}`) : ["-"]));
  sections.push("", "### Next steps");
  sections.push(...(nextSteps.length ? nextSteps.map((item) => `- ${item}`) : ["-"]));
  sections.push("", "### Tags", tags.length ? tags.join(" ") : "#idea");

  return sections.join("\n");
}

export function parseAiResponse(payload: unknown): ValidatedAiResponse {
  if (!isRecord(payload)) {
    throw new Error("AI response must be an object.");
  }

  const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
  const rawActions = Array.isArray(payload.actions) ? payload.actions : [];

  return {
    answer,
    actions: rawActions.map(parseAiAction),
  };
}

function parseAiAction(value: unknown): AiAction {
  if (!isRecord(value)) {
    throw new Error("AI action must be an object.");
  }

  const type = asNonEmptyString(value.type);

  if (!type) {
    throw new Error("AI action type is required.");
  }

  if (type === "createFolder") {
    const folderName = asNonEmptyString(value.folderName);
    const tempId = asNonEmptyString(value.tempId);

    if (!folderName || !tempId) {
      throw new Error("createFolder requires folderName and tempId.");
    }

    return { type, folderName, tempId };
  }

  if (type === "moveNotesToFolder") {
    const noteIds = asStringArray(value.noteIds);

    if (!noteIds?.length) {
      throw new Error("moveNotesToFolder requires noteIds.");
    }

    return {
      type,
      noteIds,
      folderId: asNonEmptyString(value.folderId),
      folderName: asNonEmptyString(value.folderName) ?? undefined,
      tempId: asNonEmptyString(value.tempId) ?? undefined,
    };
  }

  if (type === "addTagsToNotes") {
    const noteIds = asStringArray(value.noteIds);
    const tags = asStringArray(value.tags);

    if (!noteIds?.length || !tags) {
      throw new Error("addTagsToNotes requires noteIds and tags.");
    }

    return { type, noteIds, tags };
  }

  if (type === "createStructuredIdeaNote") {
    const title = asNonEmptyString(value.title);
    const sourceText = asNonEmptyString(value.sourceText);
    const summary = asNonEmptyString(value.summary);
    const keyIdeas = asStringArray(value.keyIdeas);
    const nextSteps = asStringArray(value.nextSteps);
    const tags = asStringArray(value.tags);
    const saveMode = value.saveMode === "ai_only" || value.saveMode === "human_plus_ai" ? value.saveMode : null;

    if (!title || !sourceText || !summary || !keyIdeas || !nextSteps || !tags || !saveMode) {
      throw new Error("createStructuredIdeaNote requires title, sourceText, summary, keyIdeas, nextSteps, tags, and saveMode.");
    }

    return {
      type,
      title,
      sourceText,
      summary,
      keyIdeas,
      nextSteps,
      tags,
      saveMode,
      openAfterSave: Boolean(value.openAfterSave),
    };
  }

  throw new Error(`Unsupported AI action type: ${type}`);
}

export function buildStructuredIdeaMetadata(action: Extract<AiAction, { type: "createStructuredIdeaNote" }>): NonNullable<Note["metadata"]> {
  return {
    capture: {
      summary: action.summary,
      keyIdeas: action.keyIdeas,
      nextSteps: action.nextSteps,
      tags: action.tags,
      saveMode: action.saveMode,
      sourceText: action.sourceText,
    },
  };
}

export function normalizeActionTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter(Boolean),
    ),
  );
}

export function normalizeResurfacingClass(value: unknown): ResurfacingClass | null {
  return value === "task" || value === "idea" || value === "reference" || value === "archive" ? value : null;
}
