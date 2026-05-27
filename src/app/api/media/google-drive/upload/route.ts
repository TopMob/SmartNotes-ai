import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Convert file to base64 data URL to mock the storage payload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const mediaId = Math.random().toString(36).slice(2);
    const fileId = `drive-${Math.random().toString(36).slice(2)}`;

    // Return a mock google-drive descriptor for seamless development
    const mediaDescriptor = {
      id: mediaId,
      provider: "google-drive",
      fileId: fileId,
      url: dataUrl,
      mimeType: file.type || "application/octet-stream",
      name: file.name || "Upload",
      size: file.size,
      thumbnailUrl: file.type.startsWith("image/") ? dataUrl : null,
    };

    return NextResponse.json(mediaDescriptor);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
