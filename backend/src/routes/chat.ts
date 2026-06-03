import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin, authenticateUser } from "../supabase.js";
import { getEmbedding, callLLM, cleanJsonResponse, parseAiResponse } from "../utils.js";

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
    {
      "type": "createFolder",
      "folderName": "Folder Name",
      "tempId": "unique-temp-id"
    },
    {
      "type": "renameFolder",
      "folderId": "folder-id",
      "name": "New folder name"
    },
    {
      "type": "updateFolderDescription",
      "folderId": "folder-id",
      "description": "New folder description details"
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
      "folderId": null,
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
      "folderId": "existing-folder-id",
      "folderName": "Folder Name",
      "tempId": "unique-temp-id",
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
14. If the user asks to edit, rewrite, clean up, format, remove extra characters, or analyze a note (whether active/currently open, or any other note in their workspace, e.g., "Сводная заметка по смысловым группам"), you have full access to its content directly in the {{NOTES_LIST}} or {{ACTIVE_NOTE_CONTEXT}}. Do NOT ask the user to open the note or claim you cannot see its content. You can read its content directly from the notes list, perform the cleanup, rewriting, or edits, and execute the "updateNote" action immediately to save the changes. Provide the complete modified content in the "content" field of the "updateNote" action.
15. CRITICAL: Do NOT use Google Gemini canvas, artifacts, document features, or immersive entry chips (like 'http://googleusercontent.com/immersive_entry_chip/0'). All code blocks, lists, and answers MUST be returned as standard, raw text or Markdown inline within the "answer" field. Do not use external placeholders or links for your code.
16. If the user asks to write, update, create, or save descriptions or information for folders (e.g., "напиши описание папкам"), map the descriptions to their respective folders using the "updateFolderDescription" action, matching the folder name to the folder ID.`;

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

export async function chatRoutes(server: FastifyInstance) {
  server.post("/chat", async (request, reply) => {
    let user;
    let isGuest = false;

    try {
      user = await authenticateUser(request.headers.authorization);
    } catch (authErr) {
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

    return reply.send({
      answer: answerText,
      citations,
      actions: actionsList,
    });
  });
}
