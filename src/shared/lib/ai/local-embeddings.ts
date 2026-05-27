import { getSupabaseUrl, getSupabaseServiceRoleKey, getSupabasePublishableKey } from "@/shared/api/supabase/env";

let extractorPromise: Promise<any> | null = null;

/**
 * Generates a 384-dimensional vector embedding for the given text.
 * First tries to call the deployed Supabase Edge Function 'embed'.
 * If that fails or credentials are not configured, falls back to the
 * local Xenova/all-MiniLM-L6-v2 model.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return new Array(384).fill(0);
  }

  // 1. Try Supabase Edge Function
  const supabaseUrl = getSupabaseUrl();
  const apiKey = getSupabaseServiceRoleKey() || getSupabasePublishableKey();

  if (supabaseUrl && apiKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
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
        console.warn(`Supabase edge function 'embed' returned status ${response.status}: ${errText}. Falling back to local model.`);
      }
    } catch (error) {
      console.warn("Failed to generate embedding via Supabase Edge Function. Falling back to local model.", error);
    }
  } else {
    console.warn("Supabase credentials not fully configured for Edge Function embeddings. Falling back to local model.");
  }

  // 2. Fallback to local model (using dynamic import to prevent loading on environments where libraries like libonnxruntime are missing)
  try {
    const { pipeline, env } = await import("@xenova/transformers");
    env.cacheDir = "./.next/cache/transformers";

    if (!extractorPromise) {
      extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    const extractor = await extractorPromise;
    const output = await extractor(cleanText, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error("Local embedding generation failed:", error);
    throw error;
  }
}
