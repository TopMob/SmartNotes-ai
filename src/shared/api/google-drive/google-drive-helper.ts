import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseUrl, requireSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

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

  const supabase = createServerClient<Database>(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch (e) {
            // Silently catch cookieStore set error in server components
          }
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("getGoogleAccessToken: User is not authenticated");
    return null;
  }

  const { data: integration, error: integrationError } = await supabase
    .from("user_google_integrations")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (integrationError) {
    console.error("getGoogleAccessToken: Error fetching user integration", integrationError);
  }

  let activeRefreshToken = integration?.refresh_token ?? sessionProviderRefreshToken ?? cookieStore.get("sb-provider-refresh-token")?.value ?? null;
  let activeAccessToken = integration?.access_token ?? sessionProviderToken ?? cookieStore.get("sb-provider-token")?.value ?? null;

  if (!activeRefreshToken) {
    const { data: { session } } = await supabase.auth.getSession();
    activeRefreshToken = session?.provider_refresh_token ?? null;
    activeAccessToken = session?.provider_token ?? null;
  }

  if (!activeRefreshToken) {
    console.warn("getGoogleAccessToken: No Google refresh token found for user", user.id);
    if (activeAccessToken) {
      return activeAccessToken;
    }
    return null;
  }

  const newAccessToken = await refreshGoogleAccessToken(activeRefreshToken);
  if (!newAccessToken) {
    console.error("getGoogleAccessToken: Failed to refresh Google access token");
    return activeAccessToken;
  }

  const { error: upsertError } = await supabase
    .from("user_google_integrations")
    .upsert({
      user_id: user.id,
      provider: "google",
      access_token: newAccessToken,
      refresh_token: activeRefreshToken,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("getGoogleAccessToken: Failed to upsert tokens into database", upsertError);
  }

  try {
    cookieStore.set("sb-provider-token", newAccessToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://localhost"),
      sameSite: "lax",
      maxAge: 3500,
    });
    cookieStore.set("sb-provider-refresh-token", activeRefreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://localhost"),
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (e) {
    // Ignore cookie write failures inside RSC
  }

  return newAccessToken;
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

  const createMetadata: Record<string, unknown> = {
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

export async function getGoogleAccessTokenForUser(userId: string): Promise<string | null> {
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) {
    console.error("getGoogleAccessTokenForUser: Missing service role key");
    return null;
  }

  // Create an admin client to query integrations for any user bypassing RLS
  const adminClient = createServerClient<Database>(
    requireSupabaseUrl(),
    serviceKey,
    {
      cookies: {
        getAll() { return []; },
        setAll() {}
      }
    }
  );

  const { data: integration, error: integrationError } = await adminClient
    .from("user_google_integrations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (integrationError) {
    console.error(`getGoogleAccessTokenForUser: Error fetching integration for user ${userId}`, integrationError);
    return null;
  }

  if (!integration?.refresh_token) {
    console.warn(`getGoogleAccessTokenForUser: No Google refresh token found for user ${userId}`);
    return integration?.access_token ?? null;
  }

  const newAccessToken = await refreshGoogleAccessToken(integration.refresh_token);
  if (!newAccessToken) {
    console.error(`getGoogleAccessTokenForUser: Failed to refresh Google access token for user ${userId}`);
    return integration.access_token;
  }

  const { error: upsertError } = await adminClient
    .from("user_google_integrations")
    .upsert({
      user_id: userId,
      provider: "google",
      access_token: newAccessToken,
      refresh_token: integration.refresh_token,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertError) {
    console.error(`getGoogleAccessTokenForUser: Failed to upsert tokens for user ${userId}`, upsertError);
  }

  return newAccessToken;
}

