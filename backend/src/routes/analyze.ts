import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin, authenticateUser } from "../supabase.js";
import { normalizeText, computeHashNode, getEmbedding, callLLM, cleanJsonResponse } from "../utils.js";

const analyzeRequestSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
});

export async function analyzeRoutes(server: FastifyInstance) {
  server.post("/analyze", async (request, reply) => {
    const user = await authenticateUser(request.headers.authorization);

    const parseResult = analyzeRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: "Invalid request body: " + parseResult.error.message });
    }

    const { noteId, title: bodyTitle, content: bodyContent } = parseResult.data;

    let title = bodyTitle;
    let content = bodyContent;
    let existingMetadata: any = {};

    const { data: dbNote } = await supabaseAdmin
      .from("notes")
      .select("title, content, metadata")
      .eq("id", noteId)
      .eq("owner_id", user.id)
      .single();

    if (dbNote) {
      if (!title) title = dbNote.title || "";
      if (!content) content = dbNote.content || "";
      existingMetadata = dbNote.metadata || {};
    }

    const combinedText = `${title || ""} ${content || ""}`;
    const normalized = normalizeText(combinedText);
    const contentHash = computeHashNode(normalized);
    const storedHash = existingMetadata?.content_hash || null;

    if (contentHash === storedHash) {
      await supabaseAdmin.from("notes").update({ ai_status: "done", analyzed: true }).eq("id", noteId);
      return reply.send({ status: "done", skipped: true });
    }

    await supabaseAdmin.from("notes").update({ ai_status: "pending" }).eq("id", noteId);

    (async () => {
      try {
        console.log(`Starting background AI analysis for note: ${noteId}`);
        await supabaseAdmin.from("notes").update({ ai_status: "analyzing" }).eq("id", noteId);

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
- summary: string — a structured, compact "AI Insight" in the note's language, as PLAIN TEXT (never markdown like ** or #). Use exactly this shape, omitting any section that would be empty:
"💡 Суть: <one concise sentence capturing the essence>

Ключевое:
 • <key point>
 • <key point>

Дальше:
 ☐ <actionable next step>
 ☐ <actionable next step>"

Rules:
- Respond ONLY with valid JSON, no markdown wrappers, no explanation
- userTags must be lowercase, single words or short hyphenated phrases
- hiddenTags can include abstract concepts, synonyms, related domains
- For "summary": translate the section labels to the note's language (English example: "💡 Gist:", "Key points:", "Next:"). Always include the "Суть/Gist" line. Include "Ключевое/Key points" only when there are concrete points (max 4 bullets). Include the "Дальше/Next" checklist ONLY for actionable notes (resurfacingClass "task"), max 4 items; omit it otherwise. Keep the whole summary under ~600 characters, concrete, no filler.
- Be concise and precise`;

        const userPrompt = `Note title: ${title || "(no title)"}\nNote content: ${plainText.slice(0, 4000) || "(empty)"}`;

        const rawResult = await callLLM(systemPrompt, userPrompt, { responseFormat: { type: "json_object" } });
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
        let relevance = typeof result.relevance === "number" ? result.relevance : 0.5;
        if (relevance > 1 && relevance <= 10) relevance = relevance / 10;
        else if (relevance > 10) relevance = relevance / 100;
        if (relevance < 0 || relevance > 1) relevance = 0.5;

        const resurfacingClass = ["task", "idea", "reference", "archive"].includes(result.resurfacingClass)
          ? result.resurfacingClass
          : "reference";

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

        const combinedText = `${title || ""} ${content || ""}`;
        const normalized = normalizeText(combinedText);
        const contentHashToSave = computeHashNode(normalized);

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

    return reply.send({ status: "queued" });
  });
}
