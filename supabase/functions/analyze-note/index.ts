import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { noteId } = await req.json();

    if (!noteId) {
      return new Response(
        JSON.stringify({ error: "noteId parameter is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Run the actual analysis in the background using Deno's EdgeRuntime.waitUntil
    // so we can respond with status: "queued" immediately!
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Starting background AI analysis for note: ${noteId}`);
        
        // 1. Update status to analyzing
        await supabase.from("notes").update({ ai_status: "analyzing" }).eq("id", noteId);

        // 2. Fetch note details
        const { data: note, error: fetchError } = await supabase
          .from("notes")
          .select("title, content, owner_id, metadata")
          .eq("id", noteId)
          .single();

        if (fetchError || !note) {
          throw new Error(`Failed to fetch note: ${fetchError?.message || "Not found"}`);
        }

        const plainText = (note.content || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // 3. Call OpenRouter to analyze the note
        const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
        const openRouterModel = Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini";
        if (!openRouterKey) {
          throw new Error("OPENROUTER_API_KEY is not set in environment.");
        }

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

        const userPrompt = `Note title: ${note.title || "(no title)"}\nNote content: ${plainText.slice(0, 4000) || "(empty)"}`;

        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2,
          })
        });

        if (!openRouterResponse.ok) {
          const errText = await openRouterResponse.text();
          throw new Error(`OpenRouter API failed: ${openRouterResponse.status} - ${errText}`);
        }

        const openRouterData = await openRouterResponse.json();
        const rawResult = openRouterData.choices?.[0]?.message?.content || "";
        
        let result;
        try {
          result = JSON.parse(rawResult.trim());
        } catch {
          // Fallback parsing if JSON has markdown block formatting
          const cleanJson = rawResult.replace(/```json/g, "").replace(/```/g, "").trim();
          result = JSON.parse(cleanJson);
        }

        const summary = result.summary || "";
        const userTags = Array.isArray(result.userTags) ? result.userTags : [];
        const hiddenTags = Array.isArray(result.hiddenTags) ? result.hiddenTags : [];
        const relevance = typeof result.relevance === "number" ? result.relevance : 0.5;
        const resurfacingClass = ["task", "idea", "reference", "archive"].includes(result.resurfacingClass) 
          ? result.resurfacingClass 
          : "reference";

        // 4. Generate Vector A (Note content embeddings) and save to note_embeddings
        const aiSession = new Supabase.ai.Session("gte-small");
        
        // Clear old embeddings first
        await supabase.from("note_embeddings").delete().eq("note_id", noteId);

        // Simple chunking for vector database
        const chunkSize = 800;
        const chunks = [];
        for (let i = 0; i < plainText.length; i += chunkSize) {
          chunks.push(plainText.slice(i, i + chunkSize));
        }

        const records = [];
        for (let i = 0; i < chunks.length; i++) {
          if (!chunks[i].trim()) continue;
          const embeddingA = await aiSession.run(chunks[i], { mean_pool: true, normalize: true });
          records.push({
            note_id: noteId,
            owner_id: note.owner_id,
            chunk_index: i,
            content: chunks[i],
            embedding: JSON.stringify(Array.from(embeddingA)),
            metadata: {},
          });
        }

        if (records.length > 0) {
          await supabase.from("note_embeddings").insert(records);
        }

        // 5. Generate Vector B (AI Insight / Summary embedding) and save to embedding_summary
        let embeddingB = null;
        if (summary) {
          const vectorB = await aiSession.run(summary, { mean_pool: true, normalize: true });
          embeddingB = Array.from(vectorB);
        }

        // 6. Math Classification via DB RPC match_folder
        let matchedFolderId = null;
        if (embeddingB) {
          const matchThreshold = parseFloat(Deno.env.get("MATCH_THRESHOLD") || "0.82");
          const { data: folderId, error: matchError } = await supabase.rpc("match_folder", {
            query_embedding: JSON.stringify(embeddingB),
            match_threshold: matchThreshold,
            p_owner_id: note.owner_id
          });

          if (matchError) {
            console.error("match_folder RPC error:", matchError);
          } else {
            matchedFolderId = folderId;
          }
        }

        // 7. Fallback to System Folder if no match
        if (!matchedFolderId) {
          const { data: systemFolderId, error: systemFolderError } = await supabase.rpc("get_or_create_system_folder", {
            p_owner_id: note.owner_id
          });

          if (systemFolderError) {
            throw new Error(`get_or_create_system_folder RPC error: ${systemFolderError.message}`);
          }
          matchedFolderId = systemFolderId;
        }

        // 8. Calculate SHA-256 hash of normalized text to save in metadata
        const msgBuffer = new TextEncoder().encode(
          plainText.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
        );
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const contentHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        // 9. Update the note with results
        const currentMetadata = note.metadata || {};
        const newMetadata = {
          ...currentMetadata,
          summary: summary || currentMetadata.summary || null,
          promptVersion: "v1.0",
          content_hash: contentHash,
        };

        const { error: updateError } = await supabase
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
          throw new Error(`Failed to update note: ${updateError.message}`);
        }

        console.log(`Background AI analysis succeeded for note: ${noteId}`);
      } catch (err: any) {
        console.error(`Error in background AI analysis for note ${noteId}:`, err);
        await supabase
          .from("notes")
          .update({
            ai_status: "error",
            ai_error: err.message || String(err),
          })
          .eq("id", noteId);
      }
    })());

    return new Response(
      JSON.stringify({ status: "queued" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
