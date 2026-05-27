import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  let userId: string | null = null;
  let providerToken: string | null = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
    providerToken = session?.provider_token ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!providerToken) {
    return NextResponse.json({ error: "Google credentials not available. Please sign in with Google." }, { status: 400 });
  }

  try {
    // 1. Fetch metadata first to get correct filename and mimeType (optional but nice)
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    });

    let filename = "Download";
    let mimeType = "application/octet-stream";
    let size: string | null = null;

    if (metadataResponse.ok) {
      const meta = await metadataResponse.json();
      filename = meta.name || filename;
      mimeType = meta.mimeType || mimeType;
      size = meta.size || null;
    }

    // 2. Fetch the actual file contents
    const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    });

    if (!driveResponse.ok) {
      const text = await driveResponse.text();
      return NextResponse.json({ error: `Failed to fetch from Google Drive: ${text}` }, { status: driveResponse.status });
    }

    // 3. Stream the file content back to the client
    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    if (size) {
      headers.set("Content-Length", size);
    }
    
    // Convert Response body (ReadableStream) to Next Response
    return new Response(driveResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 }
    );
  }
}
