import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { openRouterComplete } from "@/shared/api/openrouter/openrouter-client";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { getEmbedding } from "@/shared/lib/ai/local-embeddings";
import type { Note } from "@/entities/note";
import { parseAiResponse } from "@/features/ai-engine/model/agent-actions";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const CHAT_SYSTEM_PROMPT = `You are a personal AI organizer and assistant for the SmartNotes app.
Your goal is to answer user queries and organize their workspace.

You have access to:
1. User's existing folders: {{FOLDERS}}
2. User's full notes list (metadata only): {{NOTES_LIST}}
3. Semantic RAG context for detailed note contents (if relevant): {{RAG_CONTEXT}}
4. Recent conversation history: {{CHAT_HISTORY}}

IMPORTANT: You MUST ALWAYS respond with a valid, clean JSON object. Do not return markdown wrappers like \`\`\`json.

Response Schema:
{
  "answer": "Text explanation in the user's language. Can be markdown (bold, lists, etc.). Describe what you are suggesting or answering. When referencing specific notes, use [Note: \\"Title\\"] format.",
  "actions": [
    // Array of actions to perform. Only generate when requested to organize, move, tag, or structure folders.
    // Order matters: place createFolder first, then moveNotesToFolder, then addTagsToNotes.
    {
      "type": "createFolder",
      "folderName": "Folder Name",
      "tempId": "unique-temp-id" // temporary ID to resolve after creation (e.g., "temp-1")
    },
    {
      "type": "renameFolder",
      "folderId": "folder-id",
      "name": "New folder name"
    },
    {
      "type": "trashFolder",
      "folderId": "folder-id"
    },
    {
      "type": "restoreFolder",
      "folderId": "folder-id"
    },
    {
      "type": "deleteFolder",
      "folderId": "folder-id"
    },
    {
      "type": "mergeFolders",
      "sourceFolderIds": ["folder-a", "folder-b"],
      "targetFolderId": "folder-target",
      "deleteSources": true
    },
    {
      "type": "createNote",
      "title": "Note title",
      "content": "Full note content",
      "folderId": "folder-id",
      "tags": ["tag1"],
      "openAfterSave": true
    },
    {
      "type": "updateNote",
      "noteId": "note-id",
      "appendContent": "New details",
      "tags": ["updated"],
      "resurfacingClass": "idea"
    },
    {
      "type": "renameNote",
      "noteId": "note-id",
      "title": "New note title"
    },
    {
      "type": "moveNotesToFolder",
      "folderId": "existing-folder-id", // if using an existing folder
      "folderName": "Folder Name",      // folder name
      "tempId": "unique-temp-id",      // matches tempId from createFolder action above if creating a new one
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "mergeNotes",
      "noteIds": ["note-id-1", "note-id-2"],
      "title": "Merged note title",
      "deleteSources": true,
      "openAfterSave": true
    },
    {
      "type": "trashNotes",
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "restoreNotes",
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "deleteNotes",
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "archiveNotes",
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "unarchiveNotes",
      "noteIds": ["note-id-1", "note-id-2"]
    },
    {
      "type": "addTagsToNotes",
      "noteIds": ["note-id-1"],
      "tags": ["tag1", "tag2"]
    },
    {
      "type": "removeTagsFromNotes",
      "noteIds": ["note-id-1"],
      "tags": ["tag1"]
    },
    {
      "type": "createStructuredIdeaNote",
      "title": "Short title",
      "sourceText": "Original free-form user thought",
      "summary": "Concise summary",
      "keyIdeas": ["idea 1", "idea 2"],
      "nextSteps": ["step 1", "step 2"],
      "tags": ["idea", "research"],
      "saveMode": "human_plus_ai",
      "openAfterSave": true
    }
  ]
}

Guidelines:
1. If the user asks to organize, categorize, group, tag, move, rename, merge, archive, restore, delete, or create notes/folders, study the full notes list, decide on the correct safe actions, and output the required actions.
2. If notes fit well into existing folders, use them. If they belong in a new folder, suggest creating it first and then moving notes into it.
3. If the user gives a free-form thought and asks to save, capture, structure, or turn it into a note, and they did not specify whether to include the raw thought at the top, ask exactly: "Написать в начале ваши мысли без структурирования?" and return no actions yet.
4. If the user answers yes/no to that follow-up, use the recent conversation history to create exactly one createStructuredIdeaNote action using the earlier thought text.
5. For createStructuredIdeaNote, use saveMode "human_plus_ai" when the user wants the raw thought kept at the top; otherwise use "ai_only".
6. For destructive or ambiguous requests, prefer proposing a candidate plan first. For example, for "merge similar notes" first list the exact candidate notes and ask for confirmation instead of inventing unsafe merges.
7. Never act on notes or folders that are not clearly the user's own. Use only ids that exist in the provided note/folder lists.
8. Be professional and concise. If a question is a simple search or query, "actions" must be an empty array [].
9. Always respond in the user's language (e.g. Russian if the question is in Russian).`;

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function buildConversationContext(messages: ChatMessage[]) {
  if (messages.length === 0) {
    return "This is a new chat. There is no previous conversation yet.";
  }

  return [
    "This is an existing chat.",
    "Previous conversation messages are listed below in chronological order.",
    ...messages.map((message, index) => `${index + 1}. ${message.role.toUpperCase()}: ${message.text}`),
  ].join("\n");
}

interface EmbeddingMatch {
  note_id: string;
  note_title?: string;
  content: string;
}

function cleanJsonResponse(text: string): string {
  let clean = text.trim();
  if (clean.startsWith("```json")) {
    clean = clean.substring(7);
  } else if (clean.startsWith("```")) {
    clean = clean.substring(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.substring(0, clean.length - 3);
  }
  return clean.trim();
}

export async function POST(request: Request) {
  let question: string;
  let clientNotes: Note[] | undefined;
  let clientFolders: any[] | undefined;
  let chatHistory: ChatMessage[] = [];

  try {
    const body = await request.json();
    question = body.question;
    clientNotes = body.notes;
    clientFolders = body.folders;
    chatHistory = Array.isArray(body.messages)
      ? body.messages
          .filter((message: unknown): message is ChatMessage =>
            typeof message === "object" &&
            message !== null &&
            "role" in message &&
            "text" in message &&
            ((((message as ChatMessage).role === "user") || ((message as ChatMessage).role === "assistant")) && typeof (message as ChatMessage).text === "string"),
          )
          .slice(-8)
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
  }

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400, headers: CORS_HEADERS });
  }

  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId && (!clientNotes || !Array.isArray(clientNotes))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  // Fallback for guest or if client passed notes explicitly
  let notesForContext = clientNotes || [];
  let foldersForContext = clientFolders || [];

  if (userId && (!clientNotes || !clientFolders)) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        requireSupabaseUrl(),
        requireSupabasePublishableKey(),
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
      );
      
      if (!clientNotes) {
        const { data: dbNotes } = await supabase
          .from("notes")
          .select("id, title, folder_id, user_tags")
          .eq("owner_id", userId)
          .is("trashed_at", null);
        if (dbNotes) {
          notesForContext = dbNotes.map(n => ({
            id: n.id,
            title: n.title,
            folderId: n.folder_id,
            userTags: n.user_tags || [],
          } as any));
        }
      }
      
      if (!clientFolders) {
        const { data: dbFolders } = await supabase
          .from("folders")
          .select("id, name")
          .eq("owner_id", userId)
          .is("trashed_at", null);
        if (dbFolders) {
          foldersForContext = dbFolders;
        }
      }
    } catch (dbErr) {
      console.error("Database fetch failed in AI route:", dbErr);
    }
  }

  let chunks: EmbeddingMatch[] = [];

  // Semantic Vector Search for detailed content (RAG)
  if (!userId && clientNotes && Array.isArray(clientNotes)) {
    try {
      const questionEmbedding = await getEmbedding(question);
      const allChunks: { note_id: string; note_title: string; content: string }[] = [];

      for (const note of clientNotes) {
        if (note.lock) continue; // Skip locked notes

        if (note.pages && note.pages.length > 0) {
          for (const page of note.pages) {
            if (page.content?.trim()) {
              allChunks.push({
                note_id: note.id,
                note_title: note.title || "Без названия",
                content: page.content.replace(/<[^>]*>/g, " ").trim(),
              });
            }
          }
        } else if (note.content?.trim()) {
          allChunks.push({
            note_id: note.id,
            note_title: note.title || "Без названия",
            content: note.content.replace(/<[^>]*>/g, " ").trim(),
          });
        }
      }

      if (allChunks.length > 0) {
        const chunkEmbeddings = await Promise.all(
          allChunks.map(async (c) => {
            try {
              const emb = await getEmbedding(c.content);
              return { chunk: c, embedding: emb };
            } catch (e) {
              console.error("Failed to embed chunk:", e);
              return { chunk: c, embedding: null };
            }
          })
        );

        const cosineSimilarity = (a: number[], b: number[]) => {
          let dotProduct = 0;
          let mA = 0;
          let mB = 0;
          for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
          }
          mA = Math.sqrt(mA);
          mB = Math.sqrt(mB);
          if (mA === 0 || mB === 0) return 0;
          return dotProduct / (mA * mB);
        };

        const matches = chunkEmbeddings
          .filter((ce) => ce.embedding !== null)
          .map((ce) => {
            const similarity = cosineSimilarity(questionEmbedding, ce.embedding!);
            return {
              ...ce.chunk,
              similarity,
            };
          })
          .filter((m) => m.similarity >= 0.15)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 6);

        chunks = matches;
      }
    } catch (error) {
      console.error("Local vector matching failed:", error);
    }
  } else {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        requireSupabaseUrl(),
        requireSupabasePublishableKey(),
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
      );
      const questionEmbedding = await getEmbedding(question);
      const { data, error } = await supabase.rpc("match_note_embeddings", {
        query_embedding: questionEmbedding,
        match_threshold: 0.15,
        match_count: 6,
        p_owner_id: userId,
      });

      if (error) throw error;
      chunks = (data as EmbeddingMatch[]) || [];
    } catch (error) {
      console.error("Vector matching failed:", error);
    }
  }

  // Construct prompts with structured metadata
  const foldersMeta = JSON.stringify(foldersForContext.map(f => ({ id: f.id, name: f.name })));
  const notesMeta = JSON.stringify(notesForContext.map(n => ({
    id: n.id,
    title: n.title || "Без названия",
    folderId: n.folderId,
    tags: n.userTags || [],
  })));
  
  const ragContext = chunks.length > 0 
    ? chunks.map((chunk, i) => `[Note ${i + 1}: "${chunk.note_title || "Без названия"}"]\n${chunk.content}`).join("\n\n---\n\n")
    : "No relevant note content matches found.";

  const customizedSystemPrompt = CHAT_SYSTEM_PROMPT
    .replace("{{FOLDERS}}", foldersMeta)
    .replace("{{NOTES_LIST}}", notesMeta)
    .replace("{{RAG_CONTEXT}}", ragContext)
    .replace("{{CHAT_HISTORY}}", buildConversationContext(chatHistory));

  const userPrompt = `Question: ${question}`;

  let answerText = "";
  let actionsList: ReturnType<typeof parseAiResponse>["actions"] = [];
  try {
    const rawCompletion = await openRouterComplete(customizedSystemPrompt, userPrompt, {
      max_tokens: 1500,
      temperature: 0.2,
    });
    
    const cleaned = cleanJsonResponse(rawCompletion);
    const parsed = parseAiResponse(JSON.parse(cleaned));
    
    answerText = parsed.answer || "";
    actionsList = parsed.actions || [];
  } catch (error) {
    console.error("Structured OpenRouter parsing failed, falling back to raw mode:", error);
    // Safe text fallback
    const rawCompletion = await openRouterComplete(
      customizedSystemPrompt + "\nIMPORTANT: You must output ONLY a valid JSON object matching the schema. If you fail, just reply with a JSON containing 'answer' string and 'actions' empty array.", 
      userPrompt,
      { max_tokens: 1024 }
    );
    try {
      const cleaned = cleanJsonResponse(rawCompletion);
      const parsed = parseAiResponse(JSON.parse(cleaned));
      answerText = parsed.answer || cleaned;
      actionsList = parsed.actions || [];
    } catch {
      answerText = rawCompletion;
      actionsList = [];
    }
  }

  // Deduplicate citations by note_id
  const citations = chunks
    .map((chunk) => ({ id: chunk.note_id, title: chunk.note_title || "Без названия" }))
    .filter((val, index, self) => self.findIndex(t => t.id === val.id) === index);

  return NextResponse.json({
    answer: answerText,
    citations,
    actions: actionsList,
  }, { headers: CORS_HEADERS });
}
