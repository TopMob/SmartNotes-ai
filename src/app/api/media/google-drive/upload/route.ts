import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      status: "not_implemented",
      contract: "Upload media to the user's Google Drive and return a media descriptor, not binary payload.",
    },
    { status: 501 },
  );
}
