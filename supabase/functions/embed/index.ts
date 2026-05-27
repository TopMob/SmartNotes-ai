import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { text, isFolder } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text parameter is required and must be a string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let embeddingText = text.trim();

    if (isFolder) {
      const apiKey = Deno.env.get("OPENROUTER_API_KEY");
      if (apiKey) {
        try {
          const model = Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini";
          const systemPrompt = "You are a folder name expander. Respond ONLY with a comma-separated list of 10-15 keywords, synonyms, topics, and terms related to the folder in Russian and English. Do not write any explanations or markdown.";
          const userPrompt = `Folder name/description: ${embeddingText}`;
          
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.2,
            })
          });

          if (response.ok) {
            const data = await response.json();
            const keywords = data.choices?.[0]?.message?.content;
            if (keywords) {
              embeddingText = `${embeddingText}. Keywords: ${keywords.trim()}`;
              console.log(`Expanded folder embedding text to: ${embeddingText}`);
            }
          }
        } catch (err) {
          console.warn("Failed to expand folder text via OpenRouter. Using raw text.", err);
        }
      }
    }

    // Initialize Supabase AI Session with the 'gte-small' model (384 dimensions)
    const session = new Supabase.ai.Session("gte-small");
    const embedding = await session.run(embeddingText, { mean_pool: true, normalize: true });

    return new Response(
      JSON.stringify({ embedding: Array.from(embedding) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
