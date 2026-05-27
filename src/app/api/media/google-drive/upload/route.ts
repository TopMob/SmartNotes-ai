import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";
import { getGoogleAccessToken, getOrCreateSmartNotesPath } from "@/shared/api/google-drive/google-drive-helper";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

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

        const multipartBody = Buffer.concat([
          Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter),
          Buffer.from(`Content-Type: ${file.type}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
          Buffer.from(buffer.toString("base64")),
          Buffer.from(closeDelimiter)
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
          const mediaDescriptor = {
            id: mediaId,
            provider: "google-drive",
            fileId: fileId,
            url: `/api/media/google-drive/download?fileId=${fileId}`,
            mimeType: file.type || "application/octet-stream",
            name: file.name || "Upload",
            size: file.size,
            thumbnailUrl: file.type.startsWith("image/") ? dataUrl : null,
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

    // Fallback for local users: Return local inline descriptor
    const mediaId = Math.random().toString(36).slice(2);
    const fileId = `local-${Math.random().toString(36).slice(2)}`;

    const mediaDescriptor = {
      id: mediaId,
      provider: "local-inline",
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
