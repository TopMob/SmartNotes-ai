// НИКАКОГО Base64 ВООБЩЕ - Использовать только сырые бинарные буферы для работы с файлами!
import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { getGoogleAccessToken, getOrCreateSmartNotesPath } from "@/shared/api/google-drive/google-drive-helper";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit to prevent memory exhaustion

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let isGoogleUser = false;
  let activeToken: string | null = null;
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      requireSupabaseUrl(),
      requireSupabasePublishableKey(),
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    );
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
    
    if (session?.user) {
      const user = session.user;
      isGoogleUser = user.app_metadata?.provider === "google" || user.identities?.some((i) => i.provider === "google") || false;
    }

    const sessionProviderToken = session?.provider_token ?? null;
    const sessionProviderRefreshToken = session?.provider_refresh_token ?? null;

    activeToken = isGoogleUser 
      ? await getGoogleAccessToken(sessionProviderToken, sessionProviderRefreshToken)
      : null;
  } catch (err) {
    console.error("Error retrieving Supabase session in upload route:", err);
    userId = null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isGoogleUser && !activeToken) {
    return NextResponse.json(
      { error: "Google Drive is connected but authorization is missing. Please sign out and sign in again using Google." },
      { status: 401 }
    );
  }

  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // If signed in with Google, upload to user's actual Google Drive
    if (activeToken) {
      try {
        // Retrieve or create folder SmartNotes -> image
        const imageFolderId = await getOrCreateSmartNotesPath(activeToken);

        const metadata = {
          name: file.name,
          mimeType: file.type,
          parents: [imageFolderId],
        };

        const boundary = "boundary_smartnotes_ai";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const headerPart = delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${file.type}\r\n\r\n`;

        const multipartBody = Buffer.concat([
          Buffer.from(headerPart, "utf-8"),
          buffer,
          Buffer.from(closeDelimiter, "utf-8")
        ]);

        const driveResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });

        if (driveResponse.ok) {
          const driveData = await driveResponse.json();
          const fileId = driveData.id;

          const mediaId = Math.random().toString(36).slice(2);
          const downloadUrl = `/api/media/google-drive/download?fileId=${fileId}`;
          const mediaDescriptor = {
            id: mediaId,
            provider: "google-drive",
            fileId: fileId,
            url: downloadUrl,
            mimeType: file.type || "application/octet-stream",
            name: file.name || "Upload",
            size: file.size,
            thumbnailUrl: file.type.startsWith("image/") ? downloadUrl : null,
          };

          return NextResponse.json(mediaDescriptor);
        } else {
          const errMsg = await driveResponse.text();
          console.warn("Google Drive upload failed:", errMsg);
          if (isGoogleUser) {
            return NextResponse.json({ error: `Google Drive upload failed: ${errMsg}` }, { status: 500 });
          }
        }
      } catch (err) {
        console.warn("Error uploading to Google Drive:", err);
        if (isGoogleUser) {
          return NextResponse.json({ error: err instanceof Error ? err.message : "Error uploading to Google Drive" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ error: "Google Drive integration is not connected." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
