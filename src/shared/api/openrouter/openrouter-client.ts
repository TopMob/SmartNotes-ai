




const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 55_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionRequest = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
};

export type ChatCompletionResponse = {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
};

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured.");
  return key;
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function openRouterChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const apiKey = getApiKey();
  const model = request.model ?? getModel();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://smartnotes.app",
          "X-Title": "SmartNotes AI",
        },
        body: JSON.stringify({ ...request, model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`OpenRouter error ${response.status}: ${text.slice(0, 200)}`);
      }

      return (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));


      if (lastError.name === "AbortError") break;
    }
  }

  throw lastError ?? new Error("OpenRouter request failed after retries.");
}

/** Convenience: send a prompt and return the first choice content as string */
export async function openRouterComplete(systemPrompt: string, userPrompt: string, options?: Partial<ChatCompletionRequest>): Promise<string> {
  const result = await openRouterChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    ...options,
  });

  return result.choices[0]?.message.content ?? "";
}
