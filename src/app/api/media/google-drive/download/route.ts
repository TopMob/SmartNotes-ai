import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import { getGoogleAccessTokenForUser } from "@/shared/api/google-drive/google-drive-helper";
import type { Database } from "@/shared/api/supabase/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  let currentUserId: string | null = null;
  let activeToken: string | null = null;

  try {
    const cookieStore = await cookies();
    const supabaseUser = createServerClient<Database>(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    
    // 1. Identify the currently logged-in user from the session cookies
    const { data: { session } } = await supabaseUser.auth.getSession();
    currentUserId = session?.user?.id ?? null;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Query note_pages to find the note containing this fileId using admin client to bypass RLS
    const serviceKey = getSupabaseServiceRoleKey();
    if (!serviceKey) {
      return NextResponse.json({ error: "Configuration error: missing service key" }, { status: 500 });
    }

    const supabaseAdmin = createServerClient<Database>(
      requireSupabaseUrl(),
      serviceKey,
      { cookies: { getAll: () => [], setAll: () => undefined } },
    );

    const { data: page, error: pageError } = await supabaseAdmin
      .from("note_pages")
      .select("note_id")
      .like("content", `%fileId=${fileId}%`)
      .limit(1)
      .maybeSingle();

    if (pageError) {
      console.error("Error querying note page for fileId:", pageError);
    }

    let ownerId: string = currentUserId;

    if (page?.note_id) {
      // 3. Verify the requesting user has permission to access the note using user-authenticated client
      const { data: note, error: noteError } = await supabaseUser
        .from("notes")
        .select("owner_id")
        .eq("id", page.note_id)
        .maybeSingle();

      if (noteError) {
        console.error("Error verifying note access for user:", noteError);
      }

      if (!note) {
        return NextResponse.json({ error: "Forbidden: You do not have access to this note" }, { status: 403 });
      }

      // If user has access, we use the note owner's token to download the file
      ownerId = note.owner_id;
    }

    // 4. Securely fetch and refresh the owner's Google Access Token using the admin helper
    activeToken = await getGoogleAccessTokenForUser(ownerId);
  } catch (err) {
    console.error("Error checking permissions in download route:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal verification error" }, { status: 500 });
  }

  if (!activeToken) {
    return NextResponse.json({ error: "Google credentials not available. Please sign in with Google." }, { status: 400 });
  }


  try {
    // 1. Fetch metadata first to get correct filename and mimeType (optional but nice)
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
      headers: {
        Authorization: `Bearer ${activeToken}`,
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
        Authorization: `Bearer ${activeToken}`,
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
