import { cookies } from "next/headers";

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Missing Google OAuth credentials for token refresh");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.access_token;
    } else {
      const errText = await response.text();
      console.error("Failed to refresh Google access token:", errText);
      return null;
    }
  } catch (error) {
    console.error("Error refreshing Google access token:", error);
    return null;
  }
}

export async function getGoogleAccessToken(
  sessionProviderToken: string | null,
  sessionProviderRefreshToken: string | null
): Promise<string | null> {
  const cookieStore = await cookies();
  let providerToken = cookieStore.get("sb-provider-token")?.value ?? sessionProviderToken ?? null;
  const providerRefreshToken = cookieStore.get("sb-provider-refresh-token")?.value ?? sessionProviderRefreshToken ?? null;

  if (!providerToken) {
    if (providerRefreshToken) {
      const newToken = await refreshGoogleAccessToken(providerRefreshToken);
      if (newToken) {
        cookieStore.set("sb-provider-token", newToken, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://localhost"),
          sameSite: "lax",
          maxAge: 3500, // Google access tokens expire in 3600 seconds
        });
        return newToken;
      }
    }
    return null;
  }

  return providerToken;
}

export async function getOrCreateFolder(
  name: string,
  parentFolderId: string | null,
  token: string
): Promise<string> {
  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const searchResponse = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!searchResponse.ok) {
    const errText = await searchResponse.text();
    throw new Error(`Failed to search for folder '${name}': ${errText}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createMetadata: Record<string, any> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    createMetadata.parents = [parentFolderId];
  }

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createMetadata),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create folder '${name}': ${errText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

export async function getOrCreateSmartNotesPath(token: string): Promise<string> {
  const smartNotesFolderId = await getOrCreateFolder("SmartNotes", null, token);
  const imageFolderId = await getOrCreateFolder("image", smartNotesFolderId, token);
  return imageFolderId;
}
