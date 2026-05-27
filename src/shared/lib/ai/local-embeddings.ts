import { pipeline, env } from "@xenova/transformers";

// Configure transformers cache directory in Next.js/Node environment
env.cacheDir = "./.next/cache/transformers";

let extractorPromise: Promise<any> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

/**
 * Generates a 384-dimensional vector embedding for the given text
 * using the Xenova/all-MiniLM-L6-v2 local model (free, CPU-friendly).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getExtractor();
    const cleanText = text.replace(/\s+/g, " ").trim();
    if (!cleanText) {
      return new Array(384).fill(0);
    }
    const output = await extractor(cleanText, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error("Local embedding generation failed:", error);
    throw error;
  }
}
