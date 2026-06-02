import fastify from "fastify";
import cors from "@fastify/cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { z } from "zod";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const HOST = process.env.HOST || "0.0.0.0";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Critical: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in environment variables.");
  process.exit(1);
}

// Service role Supabase client (bypasses RLS for write-heavy analyze operations and admin checks)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const server = fastify({
  logger: {
    level: "info",
  },
});

// Configure CORS
server.register(cors, {
  origin: "*",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Zod validation schemas
const chatRequestSchema = z.object({
  question: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string(),
    })
  ).optional().default([]),
  notes: z.array(z.any()).optional(),
  folders: z.array(z.any()).optional(),
  activeNoteId: z.string().nullable().optional().default(null),
  activeNoteTitle: z.string().nullable().optional().default(null),
  activeNoteContent: z.string().nullable().optional().default(null),
});

const analyzeRequestSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
});

// String utility functions replicated from SmartNotes-ai
function stripHtml(value: string): string {
  if (!value) return "";
  let clean = value;
  
  // Replace img tags with [Фото]
  clean = clean.replace(/<img[^>]*>/gi, " [Фото] ");
  
  // Replace api media download links with [Фото]
  clean = clean.replace(/\/api\/media\/google-drive\/download\?fileId=[a-zA-Z0-9-]+/g, " [Фото] ");

  return clean
    .replace(/<[^>]*>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeText(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function computeHashNode(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Supabase session authorization middleware helper
async function authenticateUser(authHeader: string | undefined) {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error("Unauthorized: Invalid session");
  }
  return user;
}

// Embed helper using Supabase Edge Function 'embed'
async function getEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return new Array(384).fill(0);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ text: cleanText }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.embedding)) {
        return data.embedding;
      }
    } else {
      const errText = await response.text();
      throw new Error(`Embedding status ${response.status}: ${errText}`);
    }
  } catch (error) {
    console.error("Failed to generate embedding via Edge Function:", error);
    throw error;
  }

  throw new Error("Failed to get embedding from Supabase Edge Function");
}

// LLM completion request helper
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://smartnotes.app",
      "X-Title": "SmartNotes AI Backend",
    },
    body: JSON.stringify({
      model: options.model || defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI Gateway error ${response.status}: ${text}`);
  }

  const resJson = await response.json();
  return resJson.choices?.[0]?.message?.content || "";
}

function cleanJsonResponse(text: string): string {
  let clean = text.trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
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

function parseAiResponse(parsed: any) {
  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

const CHAT_SYSTEM_PROMPT = `You are a personal AI organizer and assistant for the SmartNotes app.
Your goal is to answer user queries and organize their workspace.

You have access to:
1. User's existing folders: {{FOLDERS}}
2. User's notes list (with contents where relevant): {{NOTES_LIST}}
3. Semantic RAG context for detailed note contents (if relevant): {{RAG_CONTEXT}}
4. Recent conversation history: {{CHAT_HISTORY}}
5. Active open note the user is currently editing: {{ACTIVE_NOTE_CONTEXT}}

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
      "folderId": "folder-id", // use null to keep the note outside any folder
      "tags": ["tag1"],
      "openAfterSave": true
    },
    {
      "type": "updateNote",
      "noteId": "note-id",
      "appendContent": "New details",
      "folderId": null, // use null to move the note outside any folder
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
      "folderId": "existing-folder-id", // use null to move notes outside any folder
      "folderName": "Folder Name",      // omit when folderId is null
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
2. Notes do not have to belong to a folder. Treat notes with folderId = null as valid standalone notes outside folders.
3. If notes fit well into existing folders, use them. If they belong in a new folder, suggest creating it first and then moving notes into it. If the user asks to remove a note from folders or keep it outside folders, use "folderId": null and do not provide "folderName".
4. Treat these phrases as requests to keep or move notes outside folders when the context matches: "вне папки", "без папки", "убери из папки", "убрать из папки", "в корень", "отвязать от папки", "remove from folder", "no folder", "outside folders".
5. If the user gives a free-form thought and asks to save, capture, structure, or turn it into a note, and they did not specify whether to include the raw thought at the top, ask exactly: "Написать в начале ваши мысли без структурирования?" and return no actions yet.
6. If the user answers yes/no to that follow-up, use the recent conversation history to create exactly one createStructuredIdeaNote action using the earlier thought text.
7. For createStructuredIdeaNote, use saveMode "human_plus_ai" when the user wants the raw thought kept at the top; otherwise use "ai_only".
8. For destructive or ambiguous requests, prefer proposing a candidate plan first. For example, for "merge similar notes" first list the exact candidate notes and ask for confirmation instead of inventing unsafe merges. Once the user confirms the plan or says "yes", "do it", "да", "делай", etc., execute the actions immediately without asking for another confirmation.
9. Never act on notes or folders that are not clearly the user's own. Use only ids that exist in the provided note/folder lists.
10. Be professional and concise. If a question is a simple search or query, "actions" must be an empty array [].
11. Always respond in the user's language (e.g. Russian if the question is in Russian).
12. When the user asks to "group notes by meaning/topic", "merge notes by semantic groups", "объедини заметки по смыслу/группам" or similar, this means you should identify distinct thematic groups of notes (e.g. Work, Health, Sleep, Code) and create a separate "mergeNotes" action for EACH group (so notes within the same group are merged into a single note for that group, e.g. 5 different groups yield 5 merged notes). Do NOT merge all notes of completely different categories into one single giant note unless the user explicitly requests one single note for everything.
13. Avoid double confirmation loops. If the user has already given approval (e.g., "да", "делай", "ок", "подтверждаю", "go ahead", "do it") to a plan you proposed in a previous turn, do not repeat the plan or ask for confirmation again. Generate and output the corresponding "actions" immediately.
14. If the user asks to edit, rewrite, clean up, format, remove extra characters, or analyze a note (whether active/currently open, or any other note in their workspace, e.g., "Сводная заметка по смысловым группам"), you have full access to its content directly in the {{NOTES_LIST}} or {{ACTIVE_NOTE_CONTEXT}}. Do NOT ask the user to open the note or claim you cannot see its content. You can read its content directly from the notes list, perform the cleanup, rewriting, or edits, and execute the "updateNote" action immediately to save the changes. Provide the complete modified content in the "content" field of the "updateNote" action.`;

interface EmbeddingMatch {
  note_id: string;
  note_title?: string;
  content: string;
}

function buildConversationContext(messages: { role: string; text: string }[]) {
  if (messages.length === 0) {
    return "This is a new chat. There is no previous conversation yet.";
  }

  return [
    "This is an existing chat.",
    "Previous conversation messages are listed below in chronological order.",
    ...messages.map((message, index) => `${index + 1}. ${message.role.toUpperCase()}: ${message.text}`),
  ].join("\n");
}

// Endpoint 1: Chat Completion
server.post("/chat", async (request, reply) => {
  let user;
  let isGuest = false;

  try {
    user = await authenticateUser(request.headers.authorization);
  } catch (authErr) {
    // If auth fails, we check if body has notes (which means guest user)
    const body: any = request.body;
    if (body && Array.isArray(body.notes)) {
      isGuest = true;
    } else {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  }

  const parseResult = chatRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: "Invalid request body: " + parseResult.error.message });
  }

  const {
    question,
    messages = [],
    notes: clientNotes,
    folders: clientFolders,
    activeNoteId,
    activeNoteTitle,
    activeNoteContent,
  } = parseResult.data;

  let notesForContext = clientNotes || [];
  let foldersForContext = clientFolders || [];

  if (!isGuest && user) {
    try {
      const { data: dbNotes } = await supabaseAdmin
        .from("notes")
        .select("id, title, folder_id, user_tags, content, updated_at, metadata, analyzed")
        .eq("owner_id", user.id)
        .is("trashed_at", null)
        .order("updated_at", { ascending: false });

      if (dbNotes) {
        notesForContext = dbNotes.map(n => ({
          id: n.id,
          title: n.title,
          folderId: n.folder_id,
          userTags: n.user_tags || [],
          content: n.content || "",
          updatedAt: n.updated_at,
          metadata: n.metadata,
          analyzed: n.analyzed,
        }));
      }

      const { data: dbFolders } = await supabaseAdmin
        .from("folders")
        .select("id, name")
        .eq("owner_id", user.id)
        .is("trashed_at", null);

      if (dbFolders) {
        foldersForContext = dbFolders;
      }
    } catch (dbErr) {
      console.error("Database fetch failed in chat backend:", dbErr);
    }
  }

  let chunks: EmbeddingMatch[] = [];

  // RAG Search
  if (isGuest && clientNotes && Array.isArray(clientNotes)) {
    try {
      const questionEmbedding = await getEmbedding(question);
      const allChunks: { note_id: string; note_title: string; content: string }[] = [];

      for (const note of clientNotes) {
        if (note.lock) continue;

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
      console.error("Local vector matching failed for guest:", error);
    }
  } else if (user) {
    try {
      const questionEmbedding = await getEmbedding(question);
      const { data, error } = await supabaseAdmin.rpc("match_note_embeddings", {
        query_embedding: questionEmbedding,
        match_threshold: 0.15,
        match_count: 6,
        p_owner_id: user.id,
      });

      if (error) throw error;
      chunks = (data as EmbeddingMatch[]) || [];
    } catch (error) {
      console.error("Vector matching failed in chat backend:", error);
    }
  }

  // Find mentioned note IDs
  const mentionedNoteIds = new Set<string>();
  const textToSearch = (question + " " + messages.map(h => h.text).join(" ")).toLowerCase();

  for (const note of notesForContext) {
    if (!note.title) continue;
    const titleLower = note.title.toLowerCase();
    if (titleLower.length >= 4 && textToSearch.includes(titleLower)) {
      mentionedNoteIds.add(note.id);
    } else {
      try {
        const escapedTitle = titleLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTitle}\\b`, 'i');
        if (regex.test(textToSearch)) {
          mentionedNoteIds.add(note.id);
        }
      } catch (e) {
        if (textToSearch.includes(titleLower)) {
          mentionedNoteIds.add(note.id);
        }
      }
    }
  }

  let totalCharactersUsed = 0;
  const CHAR_LIMIT = 120000;

  const formattedNotes = notesForContext.map((note, idx) => {
    const isNoteActive = note.id === activeNoteId;
    const isNoteMentioned = mentionedNoteIds.has(note.id);
    const isHighPriority = isNoteActive || isNoteMentioned || idx < 10;

    const baseMeta = {
      id: note.id,
      title: note.title || "Без названия",
      folderId: note.folderId,
      tags: note.userTags || [],
    };

    const noteContent = note.content || "";

    if (isHighPriority && totalCharactersUsed + noteContent.length < CHAR_LIMIT) {
      totalCharactersUsed += noteContent.length;
      return {
        ...baseMeta,
        content: noteContent,
      };
    } else {
      const summary = (note as any).metadata?.summary;
      if (summary) {
        return {
          ...baseMeta,
          summary,
        };
      }
      const snippet = noteContent.slice(0, 150);
      return {
        ...baseMeta,
        contentSnippet: snippet ? `${snippet}...` : "",
      };
    }
  });

  const foldersMeta = JSON.stringify(foldersForContext.map(f => ({ id: f.id, name: f.name })));
  const notesMeta = JSON.stringify(formattedNotes, null, 2);

  const ragContext = chunks.length > 0
    ? chunks.map((chunk, i) => `[Note ${i + 1}: "${chunk.note_title || "Без названия"}"]\n${chunk.content}`).join("\n\n---\n\n")
    : "No relevant note content matches found.";

  const activeNoteContext = activeNoteId && activeNoteContent !== null
    ? `[Active Note: "${activeNoteTitle || "Без названия"}"]\n${activeNoteContent}`
    : "No active note is currently open.";

  const customizedSystemPrompt = CHAT_SYSTEM_PROMPT
    .replace("{{FOLDERS}}", foldersMeta)
    .replace("{{NOTES_LIST}}", notesMeta)
    .replace("{{RAG_CONTEXT}}", ragContext)
    .replace("{{ACTIVE_NOTE_CONTEXT}}", activeNoteContext)
    .replace("{{CHAT_HISTORY}}", buildConversationContext(messages));

  const userPrompt = `Question: ${question}`;

  let answerText = "";
  let actionsList: any[] = [];

  try {
    try {
      const rawCompletion = await callLLM(customizedSystemPrompt, userPrompt, {
        max_tokens: 1500,
        temperature: 0.2,
      });
      const cleaned = cleanJsonResponse(rawCompletion);
      const parsed = parseAiResponse(JSON.parse(cleaned));
      answerText = parsed.answer || "";
      actionsList = parsed.actions || [];
    } catch (error) {
      console.error("Structured AI parsing failed, falling back to raw mode:", error);
      const rawCompletion = await callLLM(
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
  } catch (err) {
    console.error("Critical AI generation error in backend:", err);
    const msg = err instanceof Error ? err.message : String(err);
    answerText = `Ошибка при обращении к ИИ: ${msg}. Пожалуйста, попробуйте еще раз или проверьте подключение.`;
    actionsList = [];
  }

  const citations = chunks
    .map((chunk) => ({ id: chunk.note_id, title: chunk.note_title || "Без названия" }))
    .filter((val, index, self) => self.findIndex(t => t.id === val.id) === index);

  return {
    answer: answerText,
    citations,
    actions: actionsList,
  };
});

// Endpoint 2: Note Analysis
server.post("/analyze", async (request, reply) => {
  const user = await authenticateUser(request.headers.authorization);

  const parseResult = analyzeRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: "Invalid request body: " + parseResult.error.message });
  }

  const { noteId, title: bodyTitle, content: bodyContent } = parseResult.data;

  // Run the analysis asynchronously on the server to prevent blocking the HTTP response (or synchronous if requested, but we'll do it async like Edge function, and return queued status)
  // Wait! In the frontend use-auto-analyze.ts, it expects:
  // if (response.ok) { lastHashRef.current = hash; setStatus("done"); ... }
  // Wait, if /analyze returns immediately with "queued" and the hook sets setStatus("done") immediately, it won't wait for actual analysis.
  // Wait, is that how Next.js `/api/ai/analyze` did it?
  // Yes! The Next.js route `/api/ai/analyze` did:
  // return NextResponse.json({ status: "queued", result: resJson }, { headers: CORS_HEADERS });
  // and use-auto-analyze setStatus("done") immediately.
  // But wait, the client is refreshing notes queries: queryClient.invalidateQueries(...) so the notes query is invalid, and it will keep refreshing until the note's status is "done".
  // Let's check: Yes! The note status is polled or updated via realtime subscriptions.
  // So returning `{ status: "queued" }` immediately and executing the analysis in the background is the correct implementation!

  // Perform background note analysis
  (async () => {
    try {
      console.log(`Starting background AI analysis for note: ${noteId}`);
      await supabaseAdmin.from("notes").update({ ai_status: "analyzing" }).eq("id", noteId);

      // Fetch note from DB if title or content not passed in request
      let title = bodyTitle;
      let content = bodyContent;

      if (!title || !content) {
        const { data: dbNote } = await supabaseAdmin
          .from("notes")
          .select("title, content")
          .eq("id", noteId)
          .eq("owner_id", user.id)
          .single();

        if (dbNote) {
          if (!title) title = dbNote.title || "";
          if (!content) content = dbNote.content || "";
        }
      }

      const plainText = (content || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const systemPrompt = `You are a smart note classification AI for the SmartNotes app.
Your job is to analyze a note and return a JSON object with the following fields:
- userTags: string[] — 2 to 5 short, lowercase, visible hashtags relevant to the note content
- hiddenTags: string[] — 3 to 8 semantic concepts for internal search and retrieval (can be longer phrases)
- relevance: number — importance/usefulness score between 0 and 1 (0 = trivial/archive, 1 = critical)
- resurfacingClass: "task" | "idea" | "reference" | "archive" — how this note should resurface over time
- summary: string — a brief 1-2 sentence summary of the note, in the language of the note, highlighting key takeaways (AI Insight)

Rules:
- Respond ONLY with valid JSON, no markdown, no explanation
- userTags must be lowercase, single words or short hyphenated phrases
- hiddenTags can include abstract concepts, synonyms, related domains
- Be concise and precise`;

      const userPrompt = `Note title: ${title || "(no title)"}\nNote content: ${plainText.slice(0, 4000) || "(empty)"}`;

      const rawResult = await callLLM(systemPrompt, userPrompt);
      let result;
      try {
        result = JSON.parse(rawResult.trim());
      } catch {
        const clean = cleanJsonResponse(rawResult);
        result = JSON.parse(clean);
      }

      const summary = result.summary || "";
      const userTags = Array.isArray(result.userTags) ? result.userTags : [];
      const hiddenTags = Array.isArray(result.hiddenTags) ? result.hiddenTags : [];
      const relevance = typeof result.relevance === "number" ? result.relevance : 0.5;
      const resurfacingClass = ["task", "idea", "reference", "archive"].includes(result.resurfacingClass)
        ? result.resurfacingClass
        : "reference";

      // Re-generate Note Embeddings
      await supabaseAdmin.from("note_embeddings").delete().eq("note_id", noteId);

      const chunkSize = 800;
      const chunks: string[] = [];
      for (let i = 0; i < plainText.length; i += chunkSize) {
        chunks.push(plainText.slice(i, i + chunkSize));
      }

      const records = [];
      for (let i = 0; i < chunks.length; i++) {
        if (!chunks[i].trim()) continue;
        const embeddingA = await getEmbedding(chunks[i]);
        records.push({
          note_id: noteId,
          owner_id: user.id,
          chunk_index: i,
          content: chunks[i],
          embedding: JSON.stringify(embeddingA),
          metadata: {},
        });
      }

      if (records.length > 0) {
        await supabaseAdmin.from("note_embeddings").insert(records);
      }

      let embeddingB: number[] | null = null;
      if (summary) {
        embeddingB = await getEmbedding(summary);
      }

      // Folder Classification
      const { data: noteDetails } = await supabaseAdmin
        .from("notes")
        .select("folder_id")
        .eq("id", noteId)
        .single();

      let matchedFolderId = noteDetails?.folder_id || null;
      let shouldClassify = true;

      if (matchedFolderId) {
        const { data: folder } = await supabaseAdmin
          .from("folders")
          .select("is_system")
          .eq("id", matchedFolderId)
          .maybeSingle();
        if (folder && !folder.is_system) {
          shouldClassify = false;
        }
      }

      if (shouldClassify) {
        let classificationFolderId = null;
        if (embeddingB) {
          const matchThreshold = parseFloat(process.env.MATCH_THRESHOLD || "0.82");
          const { data: folderId, error: matchError } = await supabaseAdmin.rpc("match_folder", {
            query_embedding: JSON.stringify(embeddingB),
            match_threshold: matchThreshold,
            p_owner_id: user.id
          });
          if (matchError) {
            console.error("match_folder RPC error in backend:", matchError);
          } else {
            classificationFolderId = folderId;
          }
        }

        if (classificationFolderId) {
          matchedFolderId = classificationFolderId;
        } else if (!matchedFolderId) {
          const { data: systemFolderId, error: systemFolderError } = await supabaseAdmin.rpc("get_or_create_system_folder", {
            p_owner_id: user.id
          });
          if (systemFolderError) {
            throw new Error(`get_or_create_system_folder RPC error: ${systemFolderError.message}`);
          }
          matchedFolderId = systemFolderId;
        }
      }

      // Content Hash
      const combinedText = `${title || ""} ${content || ""}`;
      const normalized = normalizeText(combinedText);
      const contentHashToSave = computeHashNode(normalized);

      // Save note updates
      const { data: existingNote } = await supabaseAdmin
        .from("notes")
        .select("metadata")
        .eq("id", noteId)
        .single();

      const currentMetadata = existingNote?.metadata || {};
      const newMetadata = {
        ...currentMetadata,
        summary: summary || (currentMetadata as any).summary || null,
        promptVersion: "v1.0",
        content_hash: contentHashToSave,
      };

      const { error: updateError } = await supabaseAdmin
        .from("notes")
        .update({
          user_tags: userTags,
          hidden_tags: hiddenTags,
          folder_id: matchedFolderId,
          ai_relevance: relevance,
          resurfacing_class: resurfacingClass,
          ai_status: "done",
          ai_processed: true,
          analyzed: true,
          ai_error: null,
          metadata: newMetadata,
          embedding_summary: embeddingB ? JSON.stringify(embeddingB) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", noteId);

      if (updateError) {
        throw new Error(`Failed to update note in DB: ${updateError.message}`);
      }

      console.log(`Background AI analysis succeeded for note: ${noteId}`);
    } catch (err: any) {
      console.error(`Error in background AI analysis for note ${noteId}:`, err);
      await supabaseAdmin
        .from("notes")
        .update({
          ai_status: "error",
          ai_error: err.message || String(err),
        })
        .eq("id", noteId);
    }
  })();

  return { status: "queued" };
});

const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`AI Backend server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
