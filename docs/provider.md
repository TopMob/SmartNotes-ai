# Codex Sale API Provider

> Configuration and instructions for AI Agents to integrate and utilize the Codex Sale provider for note analysis and completions in SmartNotes AI.

---

## Connection Specifications

Codex Sale operates as an OpenAI-compatible API provider (compatible with standard OpenAI SDKs or `@ai-sdk/openai-compatible`).

| Parameter | Value / Placeholder | Description |
| :--- | :--- | :--- |
| **Provider ID** | `codexsale` | Unique ID for the provider |
| **Provider Name** | `Codex Sale` | Display Name |
| **NPM Package** | `@ai-sdk/openai-compatible` | Recommended SDK driver |
| **Base Endpoint (baseURL)** | `https://codex.sale/v1` | Root API URL |
| **API Key (apiKey)** | `<YOUR_API_KEY>` | Bearer token (stored in `.env`) |

---

## Supported Models & Variants

All available models are reasoning-capable (`"reasoning": true`) and support standard `reasoningEffort` tuning.

| Model Name | Model ID | Default reasoningEffort | Supported Variants (reasoningEffort) |
| :--- | :--- | :--- | :--- |
| **GPT-5.4** | `gpt-5.4` | `medium` | `low`, `medium`, `high`, `xhigh` |
| **GPT-5.3 Codex** | `gpt-5.3-codex` | `medium` | `low`, `medium`, `high`, `xhigh` |
| **GPT-5.4 Mini** | `gpt-5.4-mini` | `medium` | `low`, `medium`, `high`, `xhigh` |
| **GPT-5.5** | `gpt-5.5` | `medium` | `low`, `medium`, `high`, `xhigh` |

### Reasoning Parameter Mapping

When calling these models, you can control the reasoning effort via the `reasoningEffort` parameter in the request payload options.
Example payload for chat completion:

```json
{
  "model": "gpt-5.4",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Analyze these notes." }
  ],
  "reasoningEffort": "medium"
}
```

---

## Agent Setup Guide for SmartNotes AI

To connect the application to the Codex Sale provider, configure your local environment and code clients as follows:

### 1. Environment Configuration (`.env`)

Add the following keys to your local `.env` file (do not commit real keys to GitHub):

```env
OPENROUTER_BASE_URL=https://codex.sale/v1
OPENROUTER_API_KEY=your-api-key-here
OPENROUTER_MODEL=gpt-5.4
```

### 2. Client Implementation Reference

The chat completions in this codebase are routed through [openrouter-client.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/shared/api/openrouter/openrouter-client.ts).
It reads from `process.env.OPENROUTER_BASE_URL` (defaulting to OpenRouter if not set), which redirects the request to Codex Sale when the environment is configured as above.

For custom reasoning/variant requests, you can extend the `ChatCompletionRequest` to pass `reasoningEffort`:

```typescript
export type ChatCompletionRequest = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
};
```
