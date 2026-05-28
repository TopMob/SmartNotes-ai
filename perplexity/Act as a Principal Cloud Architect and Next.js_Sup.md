<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Principal Cloud Architect and Next.js/Supabase Expert. I am building a production-ready note-taking app with Next.js (App Router), TypeScript, and Supabase. I need to permanently eradicate two critical architectural bugs related to media storage. Provide an exhaustive, bulletproof guide with complete, copy-pasteable TypeScript code and SQL scripts.

### CRITICAL BUG 1: Google Drive OAuth Drop \& Silent Upload Failure

**The Problem:** Google Drive integration drops when the browser session ends or cache is cleared. The `provider_token` is bound to the browser session, not the user's database record. Furthermore, uploads often fail silently because of token expiration or malformed multipart requests.
**Deliverables Required:**

1. **OAuth Initiation:** The exact `supabase.auth.signInWithOAuth` configuration to force Google to issue a persistent `refresh_token` (e.g., `access_type: offline`, `prompt: consent`).
2. **Database Schema:** A complete SQL migration script to create a `user_google_integrations` table in PostgreSQL to store `access_token`, `refresh_token`, and `expires_at` securely mapped to `auth.users.id`.
3. **Token Refresh \& Upload Logic:** A robust Next.js Server Action (or API Route) using the official `googleapis` npm package. This code must:
    - Retrieve the tokens from the database for the current `auth.uid()`.
    - Check if the token is expired and refresh it automatically via Google's token endpoint.
    - Perform a bulletproof file upload to Google Drive API v3 (using a proper media stream/buffer) and return the Drive file URL.

### CRITICAL BUG 2: Supabase Storage "Phantom" Null Uploads

**The Problem:** Users insert an image in the editor, it renders locally, but the database ultimately saves `null` or a broken link. The file never physically reaches the `notes-images` Supabase Storage bucket.
**Deliverables Required:**

1. **Bulletproof RLS Policies (SQL):** The absolute exact SQL commands to create Row Level Security (RLS) policies on the `storage.objects` table. I need `INSERT`, `SELECT`, `UPDATE`, and `DELETE` policies allowing authenticated users to manage ONLY their own files inside the `notes-images` bucket.
2. **Failsafe Client Upload Wrapper:** A pristine TypeScript utility function for the client-side component. It must strictly enforce this execution order:
    - Perform `await supabase.storage.from('notes-images').upload(...)`.
    - Explicitly catch and throw any upload errors (like MIME type or RLS rejections).
    - ONLY upon absolute success, call `getPublicUrl()`.
    - Return the real public URL so the frontend can safely save it to the `notes` table.

**Constraints:** Do not use generic pseudocode. I need exact SQL migrations and robust Next.js TypeScript code (with error handling) ready for a production environment.

You can fix both issues by (1) persisting Google provider tokens server‑side and always driving uploads through a server route, and (2) tightening Storage RLS plus a strict upload wrapper that never ignores errors.[^1][^2]

Below is a complete, copy‑pasteable set of SQL and TypeScript snippets.

***

## Bug 1: Stable Google OAuth + Drive Upload

### Google OAuth initiation (persistent refresh_token)

You must request offline access and force the consent screen; this is what makes Google actually issue a refresh_token.[^3][^4][^5]

**Client util (e.g. `lib/auth/google.ts`):**

```ts
// lib/auth/google.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
// or however you create the browser Supabase client

export async function connectGoogleDrive() {
  const supabase = createClientComponentClient()

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/google/callback`
      : undefined

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: [
        // minimal Drive scope for user-owned files
        'https://www.googleapis.com/auth/drive.file',
      ].join(' '),
      queryParams: {
        // critical: forces Google to issue a long‑lived refresh_token
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('Google OAuth initiation failed', error)
    throw error
  }

  // In browser flow Supabase will redirect, so data.url is usually used only
  // in non-browser environments.
  return data
}
```

That configuration (scopes + `access_type: 'offline'` + `prompt: 'consent'`) is the canonical way to get a persistent refresh token from Google with Supabase.[^4][^5][^3]

***

### SQL migration: `user_google_integrations` table

Follow Supabase’s recommendation: keep custom user data in `public` and reference `auth.users(id)` with `on delete cascade`.[^6][^7][^8]

**Migration example (`20240601_user_google_integrations.sql`):**

```sql
-- 1) Table to persist Google OAuth tokens per Supabase user
create table if not exists public.user_google_integrations (
  user_id uuid not null primary key
    references auth.users(id) on delete cascade,

  provider text not null default 'google',

  -- Provider tokens – you will encrypt them at app/network level
  access_token text,
  refresh_token text not null,
  scope text,
  token_type text,

  -- Optional: last time we successfully refreshed & used the token
  last_refreshed_at timestamptz default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_google_integrations is
  'Per-user Google OAuth tokens for Drive integration. References auth.users(id).';

-- 2) Keep timestamps fresh
create or replace function public.set_user_google_integrations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_google_integrations_updated_at
  on public.user_google_integrations;

create trigger set_user_google_integrations_updated_at
before update on public.user_google_integrations
for each row
execute procedure public.set_user_google_integrations_updated_at();

-- 3) Enable RLS and lock tokens to the owning user
alter table public.user_google_integrations enable row level security;

-- Allow each authenticated user to see only their own integration row
drop policy if exists "Users can read own Google integration"
  on public.user_google_integrations;

create policy "Users can read own Google integration"
on public.user_google_integrations
for select
to authenticated
using (auth.uid() = user_id);

-- Allow each authenticated user to insert their own row
drop policy if exists "Users can insert own Google integration"
  on public.user_google_integrations;

create policy "Users can insert own Google integration"
on public.user_google_integrations
for insert
to authenticated
with check (auth.uid() = user_id);

-- Allow each authenticated user to update their own row
drop policy if exists "Users can update own Google integration"
  on public.user_google_integrations;

create policy "Users can update own Google integration"
on public.user_google_integrations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

This gives you a single row per user keyed to `auth.users.id`, with RLS enforcing that only the owner can read or mutate their Google tokens.[^7][^6]

***

### OAuth callback route: persist provider tokens

On the OAuth callback, you need to:

1. Exchange the code for a Supabase session.
2. Read `provider_token` and `provider_refresh_token` from the session (only present right after OAuth sign‑in).[^9][^10]
3. Upsert them into `user_google_integrations`.

**Route: `app/auth/google/callback/route.ts` (App Router):**

```ts
// app/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/supabase' // your generated types

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    console.error('Google OAuth error:', errorParam)
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=error`
    )
  }

  if (!code) {
    console.error('Missing OAuth code on callback')
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=missing_code`
    )
  }

  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 1) Exchange code for Supabase session (includes provider tokens)
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('exchangeCodeForSession failed:', exchangeError)
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=exchange_error`
    )
  }

  const session = exchangeData.session
  const user = session?.user

  if (!user) {
    console.error('No user in session after Google OAuth')
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=no_user`
    )
  }

  const providerToken = session.provider_token
  const providerRefreshToken = session.provider_refresh_token

  if (!providerRefreshToken) {
    console.error(
      'No provider_refresh_token returned—ensure access_type=offline & prompt=consent'
    )
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=no_refresh_token`
    )
  }

  // 2) Persist tokens in user_google_integrations (upsert)
  const { error: upsertError } = await supabase
    .from('user_google_integrations')
    .upsert(
      {
        user_id: user.id,
        provider: 'google',
        access_token: providerToken ?? null,
        refresh_token: providerRefreshToken,
        scope: session.user?.app_metadata?.provider ?? null,
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('Failed to upsert user_google_integrations:', upsertError)
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?google=upsert_error`
    )
  }

  return NextResponse.redirect(
    `${url.origin}/settings/integrations?google=connected`
  )
}
```

This ensures Google tokens are persisted against the stable `auth.users.id`, independent of browser cookies or local storage.[^8][^9]

***

### Server‑side token refresh + Drive upload route

Use `googleapis`’ `OAuth2Client` and `drive_v3` client; store only the refresh token, and refresh on every upload (simple and robust).[^11][^12][^13]

#### Install dependencies

```bash
npm install googleapis
```

Environment variables you’ll need:

```bash
# Google OAuth client – must match your Google Cloud config
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Optional: a default folder where you store all note attachments
GOOGLE_DRIVE_NOTES_FOLDER_ID=your_drive_folder_id
```


#### API route: `app/api/google-drive/upload/route.ts`

```ts
// app/api/google-drive/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { google } from 'googleapis'
import { Readable } from 'node:stream'
import type { Database } from '@/lib/types/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!
const GOOGLE_DRIVE_NOTES_FOLDER_ID =
  process.env.GOOGLE_DRIVE_NOTES_FOLDER_ID || undefined

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // 1) Identify current user from Supabase cookie session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Unauthenticated Google Drive upload attempt', userError)
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // 2) Get persisted Google tokens from DB
    const { data: integration, error: integrationError } = await supabase
      .from('user_google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (integrationError || !integration?.refresh_token) {
      console.error(
        'No Google integration / refresh_token for user',
        integrationError
      )
      return NextResponse.json(
        { error: 'Google Drive is not connected for this user' },
        { status: 400 }
      )
    }

    // 3) Parse multipart/form-data body to obtain file
    const formData = await req.formData()
    const file = formData.get('file')
    const folderId =
      (formData.get('folderId') as string | null) ??
      GOOGLE_DRIVE_NOTES_FOLDER_ID

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing file in form-data under key "file"' },
        { status: 400 }
      )
    }

    const fileName = file.name || 'note-attachment'
    const mimeType = file.type || 'application/octet-stream'
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4) Create OAuth2 client and refresh access token using stored refresh_token
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    oAuth2Client.setCredentials({
      refresh_token: integration.refresh_token,
      access_token: integration.access_token || undefined,
    })

    // Always refresh to avoid expired access tokens
    const { credentials } = await oAuth2Client.refreshAccessToken()
    const newAccessToken = credentials.access_token
    const newRefreshToken = credentials.refresh_token || integration.refresh_token

    if (!newAccessToken) {
      console.error('Failed to refresh Google access token', credentials)
      return NextResponse.json(
        { error: 'Failed to refresh Google access token' },
        { status: 500 }
      )
    }

    // 5) Persist updated tokens (if Google rotated them)
    const { error: updateTokensError } = await supabase
      .from('user_google_integrations')
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateTokensError) {
      console.error(
        'Failed to update user_google_integrations with refreshed token',
        updateTokensError
      )
      // Non-fatal: we can still proceed with upload using in-memory tokens
    }

    // 6) Use Drive API v3 to upload the file (multipart upload via googleapis)
    const drive = google.drive({
      version: 'v3',
      auth: oAuth2Client,
    })

    const media = {
      mimeType,
      body: Readable.from(buffer),
    }

    const requestBody: any = {
      name: fileName,
    }

    if (folderId) {
      requestBody.parents = [folderId]
    }

    const driveResponse = await drive.files.create({
      requestBody,
      media,
      fields: 'id, name, webViewLink, webContentLink',
    })

    const driveFile = driveResponse.data

    if (!driveFile.id) {
      console.error('Drive upload response missing file id', driveFile)
      return NextResponse.json(
        { error: 'Drive upload did not return a file id' },
        { status: 502 }
      )
    }

    // Prefer official webViewLink; fall back to canonical URL if absent
    const fileUrl =
      driveFile.webViewLink ||
      `https://drive.google.com/file/d/${driveFile.id}/view`

    return NextResponse.json(
      {
        id: driveFile.id,
        name: driveFile.name,
        url: fileUrl,
        webViewLink: driveFile.webViewLink,
        webContentLink: driveFile.webContentLink,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('Unexpected error in Google Drive upload route:', err)

    // Distinguish Google OAuth errors so you can prompt user to reconnect
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      'Unknown server error'

    return NextResponse.json(
      {
        error: 'Google Drive upload failed',
        message,
      },
      { status: 500 }
    )
  }
}
```

This route:

- Never depends on browser‑scoped `provider_token`; it always starts from the DB‑persisted `refresh_token`.[^13][^14]
- Always refreshes the access_token before upload, eliminating silent failures from expired tokens.[^12][^13]
- Uses the official `googleapis` Drive client with a `Readable` stream, avoiding malformed multipart bodies.[^15][^16][^11]

***

## Bug 2: Supabase Storage “Phantom” Null Uploads

The root causes are usually: misconfigured RLS blocking `INSERT`, or client code ignoring `error` and writing a null/broken URL to the DB.[^2][^17]

***

### Storage RLS: only own files in `notes-images` bucket

We’ll:

1. Ensure the `notes-images` bucket exists (public, so `getPublicUrl()` works).[^18][^19]
2. Enable RLS on `storage.objects` (normally already enabled by Supabase).[^2]
3. Add `INSERT`, `SELECT`, `UPDATE`, `DELETE` policies that strictly scope access to:
    - `bucket_id = 'notes-images'`
    - owner is `auth.uid()` (via `owner_id`)
    - upload path starts with the user’s id (top‑level folder = user id).[^20][^21][^22]

**Migration example (`20240601_storage_notes_images_policies.sql`):**

```sql
-- 1) Ensure the bucket exists and is public so getPublicUrl() works
insert into storage.buckets (id, name, public)
values ('notes-images', 'notes-images', true)
on conflict (id) do update
set public = excluded.public;

-- 2) Enable RLS on storage.objects (should already be on in most projects)
alter table storage.objects enable row level security;

-- 3) Policy: users can INSERT files only into their own folder in notes-images
-- Path convention: `${auth.uid()}/some-file.ext`
drop policy if exists "notes-images users can insert into own folder" on storage.objects;

create policy "notes-images users can insert into own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'notes-images'
  and (storage.foldername(name))[^1] = auth.uid()::text
);

-- 4) Policy: users can SELECT (list/download) only their own objects in notes-images
drop policy if exists "notes-images users can select own objects" on storage.objects;

create policy "notes-images users can select own objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'notes-images'
  and owner_id = auth.uid()
);

-- 5) Policy: users can UPDATE only their own objects in notes-images
drop policy if exists "notes-images users can update own objects" on storage.objects;

create policy "notes-images users can update own objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'notes-images'
  and owner_id = auth.uid()
)
with check (
  bucket_id = 'notes-images'
  and owner_id = auth.uid()
);

-- 6) Policy: users can DELETE only their own objects in notes-images
drop policy if exists "notes-images users can delete own objects" on storage.objects;

create policy "notes-images users can delete own objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'notes-images'
  and owner_id = auth.uid()
);
```

This follows Supabase’s Storage ownership model: `owner_id` is set from the `sub` claim (user id) automatically when the Storage API is called with a user JWT.[^23][^21][^2]
The top‑level folder constraint ensures users can’t write into another user’s pseudo‑directory even if they knew its id.[^24][^22][^20]

***

### Failsafe client upload wrapper for `notes-images`

Pattern mandated by Supabase docs and best practice:[^25][^26][^17]

1. Upload first: `await supabase.storage.from('notes-images').upload(...)`.
2. If and only if `{ error }` is falsy, derive the public URL from the known path.
3. On any error, throw immediately so nothing gets written to your `notes` table.

**TypeScript utility (e.g. `lib/storage/uploadNoteImage.ts`):**

```ts
// lib/storage/uploadNoteImage.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface UploadNoteImageResult {
  path: string
  publicUrl: string
}

/**
 * Uploads a note image to the 'notes-images' bucket in the user's own folder.
 *
 * Path convention: `${userId}/${uuid}.{ext}`
 *
 * Execution order:
 *  1. upload()
 *  2. if error -> throw (NO URL is generated)
 *  3. on success -> getPublicUrl()
 */
export async function uploadNoteImage(
  supabase: SupabaseClient,
  params: { file: File | Blob; userId: string }
): Promise<UploadNoteImageResult> {
  const { file, userId } = params

  if (!userId) {
    throw new Error('uploadNoteImage: userId is required')
  }

  if (!file) {
    throw new Error('uploadNoteImage: file is required')
  }

  // Infer extension (best-effort) from MIME or name
  const fileName =
    file instanceof File && file.name ? file.name : `note-image-${crypto.randomUUID()}`
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'png'

  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const filePath = `${userId}/${uniqueName}`

  // 1) Perform upload – this is where RLS and MIME validations are enforced
  const { data, error } = await supabase.storage
    .from('notes-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType:
        file instanceof File
          ? file.type || 'application/octet-stream'
          : 'application/octet-stream',
    })

  if (error) {
    console.error('Supabase Storage upload error:', error)
    // Propagate a clear error to the editor so it NEVER writes a null/broken URL
    throw new Error(`Failed to upload note image: ${error.message}`)
  }

  if (!data?.path) {
    // Extremely defensive: upload claims success but no path
    throw new Error('Upload succeeded but Storage did not return a path')
  }

  // 2) Only after a successful upload, derive the public URL
  const { data: publicData } = supabase.storage
    .from('notes-images')
    .getPublicUrl(filePath)

  const publicUrl = publicData?.publicUrl

  if (!publicUrl) {
    throw new Error(
      'Failed to derive public URL for uploaded note image (is bucket public?)'
    )
  }

  // 3) Return the real URL that the frontend should persist into notes table
  return {
    path: filePath,
    publicUrl,
  }
}
```

`getPublicUrl()` is a pure URL builder that works only for public buckets; it doesn’t hit the DB or RLS but simply constructs the CDN URL for the given path.[^19][^18]
By centralizing this in a wrapper that always throws on upload errors, you eliminate the “phantom” scenario where the editor writes `null` or a bogus URL because it never checked `error`.[^17][^25]

***

### How to use the wrapper in your editor

In your image insertion logic (React/Next.js client component):

```ts
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { uploadNoteImage } from '@/lib/storage/uploadNoteImage'

async function handleEditorImageInsert(file: File) {
  const supabase = useSupabaseClient()
  const user = useUser()

  if (!user) throw new Error('User must be authenticated to upload images')

  const { publicUrl } = await uploadNoteImage(supabase, {
    file,
    userId: user.id,
  })

  // Only now is it safe to persist the URL into your notes table
  // e.g. editor.insertImage(publicUrl)
}
```

This ensures:

- Storage RLS either admits the upload (and the object physically exists) or throws a hard error that you can surface in the UI.[^22][^2]
- The `notes` table never records image URLs for objects that didn’t make it into the bucket.

***

You can drop these SQL migrations into Supabase’s SQL editor and these TypeScript modules into your Next.js app as‑is, then wire them into your existing auth and editor flows.
<span style="display:none">[^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59][^60][^61][^62][^63][^64][^65][^66][^67][^68][^69]</span>

<div align="center">⁂</div>

[^1]: https://supabase.com/docs/guides/auth/social-login/auth-google

[^2]: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/security/access-control.mdx

[^3]: https://github.com/orgs/supabase/discussions/33014

[^4]: https://github.com/orgs/supabase/discussions/15220

[^5]: https://www.reddit.com/r/Supabase/comments/xiqqzz/retrieving_provider_refresh_token_with_auth/

[^6]: https://supabase.com/docs/guides/auth/managing-user-data

[^7]: https://dev.to/jais_mukesh/should-you-extend-supabase-auth-with-user-profiles-2hon

[^8]: https://freeacademy.ai/lessons/supabase-auth-architecture

[^9]: https://github.com/orgs/supabase/discussions/22653

[^10]: https://www.reddit.com/r/Supabase/comments/12zo1ec/session_object_is_missing_provider_token_after/

[^11]: https://googleapis.dev/nodejs/google-auth-library/latest/classes/OAuth2Client.html

[^12]: https://github.com/googleapis/google-api-nodejs-client/issues/2350

[^13]: https://github.com/orgs/supabase/discussions/19384

[^14]: https://github.com/orgs/supabase/discussions/29578

[^15]: https://medium.com/@louistrinh/upload-files-to-google-drive-with-node-js-472512e1e181

[^16]: https://googleapis.dev/nodejs/google-auth-library/5.6.1/classes/OAuth2Client.html

[^17]: https://supabase.com/docs/guides/storage/uploads/standard-uploads

[^18]: https://supabase.com/docs/reference/swift/storage-from-getpublicurl

[^19]: https://supabase.com/docs/reference/dart/storage-from-getpublicurl

[^20]: https://supabase.com/docs/guides/storage/security/access-control

[^21]: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/security/ownership.mdx

[^22]: https://nikofischer.com/supabase-storage-file-upload-guide

[^23]: https://supabase.com/docs/guides/storage/security/ownership

[^24]: https://supabase.com/docs/guides/storage/management/copy-move-objects

[^25]: https://supabase.com/docs/reference/javascript/storage-from-upload

[^26]: https://supabase-supabase.mintlify.app/examples/storage

[^27]: https://github.com/orgs/supabase/discussions/31073

[^28]: https://gist.github.com/tanaikech/33563b6754e5054f3a5832667100fe91

[^29]: https://www.reddit.com/r/Supabase/comments/1bk606a/help_with_google_oauth/

[^30]: https://gist.github.com/tanaikech/99187753ceb5fd55d343b52dcbe176a5

[^31]: https://stackoverflow.com/questions/77087130/pass-additional-data-when-using-supabase-oauth

[^32]: https://github.com/orgs/supabase/discussions/20366

[^33]: https://gist.github.com/tanaikech/ae451679e8220f3b2d48edb3f8c1a8d3

[^34]: https://www.reddit.com/r/Supabase/comments/1dlqksf/help_how_do_i_set_up_rls_policy_for_file_upload/

[^35]: https://gist.github.com/tanaikech/5212f2a8127e1c0a70c8642e298ae661

[^36]: https://supabase.com/docs/guides/storage/buckets/fundamentals

[^37]: https://googleapis.dev/nodejs/google-auth-library/5.5.0/classes/UserRefreshClient.html

[^38]: https://supabase.com/docs/guides/auth/users

[^39]: https://github.com/orgs/supabase/discussions/1597

[^40]: https://stackoverflow.com/questions/79594298/supabase-storage-rls-violation-despite-correct-policy-check

[^41]: https://stackoverflow.com/questions/77751173/getting-auth-users-table-data-in-supabase

[^42]: https://googleapis.dev/nodejs/google-auth-library/6.1.4/classes/OAuth2Client.html

[^43]: https://dev.to/asheeshh/mastering-supabase-rls-row-level-security-as-a-beginner-5175

[^44]: https://www.reddit.com/r/Supabase/comments/1cfd5ty/storing_images_and_exposing_the_user_id_when/

[^45]: https://github.com/orgs/supabase/discussions/18415

[^46]: https://github.com/orgs/supabase/discussions/33719

[^47]: https://www.supabase.cc/docs/guides/storage/access-control

[^48]: https://freeacademy.ai/lessons/buckets-and-objects

[^49]: https://github.com/supabase/supabase/issues/35714

[^50]: https://supabase.com/docs/reference/self-hosting-storage/get-object-info

[^51]: https://www.youtube.com/watch?v=MA09FD_yGKo

[^52]: https://github.com/orgs/supabase/discussions/30045

[^53]: https://community.flutterflow.io/ask-the-community/post/supabase-and-google-auth---user-sessions-disconnecting-frequently-tW7wEa6p6feJQL5

[^54]: https://www.iloveblogs.blog/post/fix-supabase-auth-session-persistence

[^55]: https://www.reddit.com/r/Supabase/comments/11rzgzz/supabase_login_with_google_idtoken_and_access/

[^56]: https://stackoverflow.com/questions/78071008/supabase-auth-signinwithoauth-is-returning-an-url-with

[^57]: https://github.com/orgs/supabase/discussions/22578

[^58]: https://supabase.com/docs/guides/auth/auth-identity-linking

[^59]: https://github.com/supabase/supabase-js/issues/707

[^60]: https://supabase.com/docs/reference/self-hosting-auth/refreshes-a-users-refresh-token

[^61]: https://adamelvin.com/blog/supabase-storage-js-client-upload

[^62]: https://seino-prince.com/book/2b1b4ab5-d136-81dc-a1d6-ecec16ccbb92/chapter/2b1b4ab5-d136-8168-ac88-c2cad4dd2fa1/section/2b1b4ab5-d136-817c-9433-c7d07a947f6b

[^63]: https://supabase.com/docs/reference/python/storage-from-getpublicurl

[^64]: https://supabase.com/docs/guides/storage/uploads/s3-uploads

[^65]: https://github.com/orgs/supabase/discussions/1230

[^66]: https://supabase.com/docs/guides/storage/quickstart

[^67]: https://mintlify.wiki/supabase/supabase/examples/storage

[^68]: https://stackoverflow.com/questions/77679630/supabase-bucket-getpublicurl-returns-url-that-doesnt-work

[^69]: https://github.com/orgs/supabase/discussions/5888

