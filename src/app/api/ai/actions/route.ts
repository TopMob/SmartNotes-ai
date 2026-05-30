import { NextResponse } from "next/server";

import { parseAiResponse } from "@/features/ai-engine/model/agent-actions";
import { executeAgentActions } from "@/features/ai-engine/server/agent-executor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const typedBody = (body as {
      actions?: unknown;
      requestMessage?: unknown;
      conversationExcerpt?: unknown;
    }) ?? {};
    const { actions } = parseAiResponse({ answer: "", actions: typedBody.actions ?? [] });

    if (!actions.length) {
      return NextResponse.json({ error: "No actions to execute." }, { status: 400 });
    }

    const execution = await executeAgentActions(actions, {
      requestMessage: typeof typedBody.requestMessage === "string" ? typedBody.requestMessage : undefined,
      conversationExcerpt: Array.isArray(typedBody.conversationExcerpt)
        ? typedBody.conversationExcerpt.filter(
            (message): message is { role: "user" | "assistant"; text: string } =>
              typeof message === "object" &&
              message !== null &&
              "role" in message &&
              "text" in message &&
              (((message as { role?: unknown }).role === "user") || ((message as { role?: unknown }).role === "assistant")) &&
              typeof (message as { text?: unknown }).text === "string",
          )
        : undefined,
    });
    return NextResponse.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute actions.";
    const status = message === "Unauthorized" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
