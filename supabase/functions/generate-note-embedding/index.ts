import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    content: string;
    embedding_status?: string;
  };
  old_record: any;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const aiSession = new Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    console.log(`Received database webhook payload: ${JSON.stringify(payload)}`);

    if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
      return new Response("ignored event type", { headers: corsHeaders, status: 200 });
    }

    const record = payload.record;
    if (!record || !record.id) {
      return new Response("missing record details", { headers: corsHeaders, status: 400 });
    }

    // Strip HTML tags and clean up whitespace for accurate embedding
    const plainText = (record.content || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) {
      console.log(`Note ${record.id} content is empty. Setting embedding_status to ready with NULL embedding.`);
      await supabase
        .from("notes")
        .update({
          embedding: null,
          embedding_status: "ready",
        })
        .eq("id", record.id);
      return new Response("empty note content handled", { headers: corsHeaders, status: 200 });
    }

    // 1. Generate embedding using gte-small (384 dimensions)
    console.log(`Generating embedding for note ${record.id} using gte-small...`);
    const embedding = await aiSession.run(plainText, {
      mean_pool: true,
      normalize: true,
    });

    // 2. Update the note with the generated embedding vector and mark as ready
    const { error: updateError } = await supabase
      .from("notes")
      .update({
        embedding: JSON.stringify(Array.from(embedding)),
        embedding_status: "ready",
      })
      .eq("id", record.id);

    if (updateError) {
      console.error(`Failed to update note ${record.id} with embedding:`, updateError.message);
      return new Response("db update error", { headers: corsHeaders, status: 500 });
    }

    console.log(`Successfully generated and saved embedding for note: ${record.id}`);
    return new Response("ok", { headers: corsHeaders, status: 200 });
  } catch (err: any) {
    console.error("Embedding generation failed:", err);

    try {
      // Attempt to update the embedding_status to error
      const body = await req.clone().json().catch(() => ({}));
      const recordId = body?.record?.id;
      if (recordId) {
        await supabase
          .from("notes")
          .update({ embedding_status: "error" })
          .eq("id", recordId);
      }
    } catch (dbErr) {
      console.error("Failed to mark status as error in db:", dbErr);
    }

    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
