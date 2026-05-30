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
    const { actions } = parseAiResponse({ answer: "", actions: (body as { actions?: unknown })?.actions ?? [] });

    if (!actions.length) {
      return NextResponse.json({ error: "No actions to execute." }, { status: 400 });
    }

    const execution = await executeAgentActions(actions);
    return NextResponse.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute actions.";
    const status = message === "Unauthorized" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
