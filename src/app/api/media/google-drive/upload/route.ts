import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "@/shared/api/supabase/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    if (providerToken) {
      try {
        const metadata = {
          name: file.name,
          mimeType: file.type,
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
            Authorization: `Bearer ${providerToken}`,
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
          console.warn("Google Drive upload failed, falling back to local storage:", errMsg);
        }
      } catch (err) {
        console.warn("Error uploading to Google Drive, falling back to local storage:", err);
      }
    }

    // Fallback: Return a mock/local inline descriptor
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
