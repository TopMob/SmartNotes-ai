import { NextResponse } from "next/server";

import type { AnalyzeNoteRequest } from "@/features/ai-engine/model/types";
import { createAnalyzePlan } from "@/features/ai-engine/server/create-analyze-plan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeNoteRequest;
  const plan = createAnalyzePlan(body);

  return NextResponse.json({ status: "queued", plan });
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",");

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-secret",
    },
  });
}
