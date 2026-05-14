# API Reference

> SmartNotes AI — all endpoints, hooks, and integration points.

---

## 1. Server API Routes

All API routes are implemented as Next.js App Router route handlers under `src/app/api/`.

### 1.1 AI Analyze

**`POST /api/ai/analyze`**

Analyzes a note using the AI pipeline (OpenRouter LLM). Returns classification results.

| Property | Value |
|----------|-------|
| Runtime | `nodejs` |
| Auth | User cookie **or** admin `x-secret` header |
| CORS | Enabled (`*` origin, POST + OPTIONS) |

**Request Body:**

```typescript
type AnalyzeNoteRequest = {
  noteId: string;           // Required — target note ID
  title: string;            // Note title
  content: string;          // Note HTML content
  userTags: string[];       // Current user tags
  folderContext: Array<{    // Available folders for classification
    id: string;
    name: string;
    description: string | null;
  }>;
  drawingDescriptions?: string[];  // Optional — canvas drawing descriptions
};
```

**Response (200):**

```typescript
type AnalyzeNoteResponse = {
  status: "done";
  result: {
    userTags: string[];           // 2–5 visible hashtags
    hiddenTags: string[];         // 3–8 semantic concepts
    folderId: string | null;      // Suggested folder ID
    relevance: number;            // 0–1 importance score
    resurfacingClass: "task" | "idea" | "reference" | "archive";
    promptVersion: string;        // e.g. "v1.0"
  };
};
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| `401` | No valid user session and no admin secret |
| `400` | Missing `noteId` or invalid JSON body |
| `500` | AI analysis failed — note `ai_status` set to `"error"` |

**Admin Mode:** When `x-secret` header matches `AI_ADMIN_SECRET` env var, user auth is bypassed. Used for batch reindex operations.

---

### 1.2 AI Chat

**`POST /api/ai/chat`**

Conversational AI chat that answers questions based on the user's own notes (RAG-style retrieval).

| Property | Value |
|----------|-------|
| Runtime | `nodejs` |
| Auth | User cookie (required) |
| CORS | Enabled |

**Request Body:**

```typescript
type AiChatRequest = {
  question: string;  // Required — user's question
};
```

**Process:**

1. Fetch all user notes from Supabase
2. Score each note against the question tokens (title weight: 2x, userTags: 1.5x, content: 1x)
3. Select top-N relevant notes as context
4. Send system prompt + context + question to OpenRouter
5. Return LLM response with note citations

**Response (200):**

```typescript
type AiChatResponse = {
  answer: string;       // AI response text with [Note: "title"] citations
  sources: Array<{      // Notes used as context
    id: string;
    title: string;
  }>;
};
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| `401` | No valid user session |
| `400` | Empty or missing `question` |

---

### 1.3 Health Check

**`GET /api/health`**

Simple service health check. No auth required.

**Response (200):**

```typescript
type HealthResponse = {
  ok: boolean;
  service: "smartnotes";
  version: string;  // e.g. "0.1.0"
};
```

---

### 1.4 Google Drive Upload Proxy

**`POST /api/media/google-drive/upload`**

BYOS media upload proxy. Currently a **stub** — returns `501 Not Implemented`.

| Property | Value |
|----------|-------|
| Runtime | `nodejs` |
| Status | **Not implemented** |

**Contract (planned):**

Upload media to the user's Google Drive and return a `MediaDescriptor`, not binary payload.

**Current Response (501):**

```typescript
{
  status: "not_implemented",
  contract: "Upload media to the user's Google Drive and return a media descriptor, not binary payload."
}
```

---

### 1.5 Supabase Runtime Config

**`GET /api/supabase/config`**

Returns public configuration needed for client-side Supabase and Google auth initialization. No auth required.

| Property | Value |
|----------|-------|
| Runtime | `edge` (default) |
| Cache | `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` |

**Response (200):**

```typescript
type RuntimeConfigResponse = {
  url: string | null;            // Supabase project URL
  publishableKey: string | null; // Supabase anon/publishable key
  googleClientId: string | null; // Google OAuth Client ID
};
```

**Fallback chain:**

| Field | Primary | Fallback 1 | Fallback 2 |
|-------|---------|------------|------------|
| `url` | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL` | `null` |
| `publishableKey` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY` |
| `googleClientId` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` | `NEXT_PUBLIC_SMARTNOTES_GOOGLE_CLIENT_ID` |

---

### 1.6 Auth Callback

**`GET /auth/callback`**

OAuth code exchange endpoint. Handles the redirect from Google OAuth.

| Property | Value |
|----------|-------|
| Auth | Public (no session required) |

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `code` | Yes | OAuth authorization code from Google |
| `next` | No | Redirect path after successful auth (defaults to `/`) |

**Process:**

1. Validate `code` parameter
2. Create Supabase server client
3. Exchange code for session (`exchangeCodeForSession`)
4. Set session cookies on the response
5. Redirect to `next` path or `/`

**Error Redirects:**

| Condition | Redirect |
|-----------|----------|
| Missing `code` | `/login?error=missing_code` |
| Missing Supabase config | `/login?error=missing_config` |
| Exchange failed | `/login?error={message}` |

---

## 2. Client Hooks

### 2.1 Auth Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAuthActions` | [`features/auth/hooks/use-auth-actions.ts`](src/features/auth/hooks/use-auth-actions.ts:1) | Login, logout, session management actions |
| `useAuthStore` | [`features/auth/model/auth-store.ts`](src/features/auth/model/auth-store.ts:1) | Zustand store: `status`, `user`, `degraded`, `runtimeConfig` |

### 2.2 Notes Hooks

| Hook | File | Description |
|------|------|-------------|
| `useNotesQuery` | [`features/notes/hooks/use-notes-query.ts`](src/features/notes/hooks/use-notes-query.ts:1) | Fetch user notes with pagination, filtering, sorting |
| `useNoteMutations` | [`features/notes/hooks/use-note-mutations.ts`](src/features/notes/hooks/use-note-mutations.ts:1) | Create, update, trash, restore, delete notes (optimistic) |
| `useAutoAnalyze` | [`features/ai-engine/hooks/use-auto-analyze.ts`](src/features/ai-engine/hooks/use-auto-analyze.ts:1) | Debounced auto-trigger AI analysis on note changes |

### 2.3 Folders Hooks

| Hook | File | Description |
|------|------|-------------|
| `useFoldersQuery` | [`features/folders/hooks/use-folders-query.ts`](src/features/folders/hooks/use-folders-query.ts:1) | Fetch user folders |
| `useFolderMutations` | [`features/folders/hooks/use-folder-mutations.ts`](src/features/folders/hooks/use-folder-mutations.ts:1) | Create, update, delete, hide/unhide folders |

### 2.4 Settings Hooks

| Hook | File | Description |
|------|------|-------------|
| `useSettingsQuery` | [`features/settings/hooks/use-settings-query.ts`](src/features/settings/hooks/use-settings-query.ts:1) | Fetch user settings (theme, language, editor config) |
| `useSettingsMutations` | [`features/settings/hooks/use-settings-mutations.ts`](src/features/settings/hooks/use-settings-mutations.ts:1) | Update user settings (partial patches) |

### 2.5 Editor Collab Hooks

| Hook | File | Description |
|------|------|-------------|
| `useNoteCollabSession` | [`features/editor-collab/hooks/use-note-collab-session.tsx`](src/features/editor-collab/hooks/use-note-collab-session.tsx:1) | Yjs doc + IndexedDB + Realtime channel lifecycle |
| `useDurableNoteSave` | [`features/editor-collab/hooks/use-durable-note-save.ts`](src/features/editor-collab/hooks/use-durable-note-save.ts:1) | Debounced save with error handling and status tracking |
| `useNoteCollabPage` | [`features/editor-collab/hooks/use-note-collab-page.ts`](src/features/editor-collab/hooks/use-note-collab-page.ts:1) | Page navigation within multi-page notes |
| `useNoteTitleTags` | [`features/editor-collab/hooks/use-note-title-tags.ts`](src/features/editor-collab/hooks/use-note-title-tags.ts:1) | Auto-derive title and tags from Yjs doc content |

### 2.6 App Shell Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAppShellState` | [`features/app-shell/ui/hooks/use-app-shell-state.ts`](src/features/app-shell/ui/hooks/use-app-shell-state.ts:1) | Global shell state: sidebar, editor, current note, view mode |
| `useNoteInteractions` | [`features/app-shell/ui/hooks/use-note-interactions.ts`](src/features/app-shell/ui/hooks/use-note-interactions.ts:1) | Note card actions: pin, archive, delete, move, lock |
| `useReminderEffects` | [`features/app-shell/ui/hooks/use-reminder-effects.ts`](src/features/app-shell/ui/hooks/use-reminder-effects.ts:1) | Reminder scheduling and notification effects |

### 2.7 Search Hooks

| Hook | File | Description |
|------|------|-------------|
| `useSearchStore` | [`features/search/model/search-store.ts`](src/features/search/model/search-store.ts:1) | Search query, filters, results state |

---

## 3. React Query Keys

All query keys are centralized in [`shared/lib/react-query/query-keys.ts`](src/shared/lib/react-query/query-keys.ts:1).

| Key Pattern | Entity | Description |
|-------------|--------|-------------|
| `notes` | Note | All owned notes list |
| `notes.detail(id)` | Note | Single note with pages, media, access |
| `folders` | Folder | All owned folders list |
| `settings` | Settings | User settings singleton |

---

## 4. Supabase Client API

### 4.1 Browser Client

[`shared/api/supabase/client.ts`](src/shared/api/supabase/client.ts:1) — `createSupabaseBrowserClient()`

- Uses `@supabase/ssr` for cookie-based session management
- Singleton pattern — created once per browser session
- Returns `null` if Supabase URL/key are unavailable (degraded mode)

### 4.2 Server Client

[`shared/api/supabase/server.ts`](src/shared/api/supabase/server.ts:1) — `createSupabaseServerClient()`

- Used in API routes and middleware
- Reads cookies from `next/headers` cookie store
- Full `Database` type generic for typed queries

### 4.3 Middleware Client

[`shared/api/supabase/middleware.ts`](src/shared/api/supabase/middleware.ts:1) — `updateSupabaseSession()`

- Refreshes auth session on every request
- Sets updated cookies on the response

---

## 5. OpenRouter Client API

[`shared/api/openrouter/openrouter-client.ts`](src/shared/api/openrouter/openrouter-client.ts:1)

### 5.1 `openRouterChat(request)`

Full chat completion API call with retry logic.

| Parameter | Type | Default |
|-----------|------|---------|
| `messages` | `ChatMessage[]` | Required |
| `model` | `string` | `OPENROUTER_MODEL` or `openai/gpt-4o-mini` |
| `temperature` | `number` | — |
| `max_tokens` | `number` | — |
| `response_format` | `{ type: "json_object" | "text" }` | — |

**Retry behavior:** 3 attempts with exponential backoff (1s, 2s, 4s). 30s request timeout per attempt.

### 5.2 `openRouterComplete(systemPrompt, userPrompt, options?)`

Convenience wrapper — sends system + user prompt and returns the first choice content as a plain string.

---

## 6. Event Bus API

[`services/event-bus.ts`](src/services/event-bus.ts:1) — typed pub/sub event system.

### Events

| Event | Payload | Produced By | Consumed By |
|-------|---------|-------------|-------------|
| `reminderTriggered` | `{ noteId: string }` | Reminder service | Notification service, UI |
| `syncQueued` | `{ entity, id }` | Note/folder/settings mutations | Sync consumer |
| `syncCompleted` | `{ processedCount, failedCount }` | Sync consumer | UI toast |
| `syncFailed` | `{ message }` | Sync consumer | UI toast |
| `feedbackSubmitted` | `{ rating, feedback, diagnostics, systemLanguage, userAgent }` | Feedback modal | Feedback API |
| `noteImported` | `{ noteId, title }` | Import service | UI toast |
| `toast` | `{ id?, message, tone? }` | Various features | Toast display |

### API

```typescript
// Subscribe — returns unsubscribe function
const unsub = subscribe("reminderTriggered", (payload) => { ... });
unsub();

// Publish
publish("toast", { message: "Note saved", tone: "success" });
```

---

## 7. Lock Service API

[`features/lock-center/lib/lock-service.ts`](src/features/lock-center/lib/lock-service.ts:1)

### `createNoteLock(password: string): Promise<NoteLock>`

Creates a lock object with SHA-256 hash + random salt. Returns `NoteLock` with `v: 2`.

### `verifyNoteLock(lock: NoteLock, password: string): Promise<boolean>`

Verifies password against stored hash using timing-safe comparison (`secureCompare`).

### `maskLockedPreview(noteId: string): string`

Returns a placeholder text for locked note previews: `"Защищенная заметка {id}. Введите пароль для просмотра."`

---

## 8. Search Engine API

[`features/search/lib/search-engine.ts`](src/features/search/lib/search-engine.ts:1)

### `normalizeText(text: string): string`

Lowercases, replaces `ё` → `е`, trims.

### `fixLayout(text: string): string[]`

Returns search variants: original normalized + EN→RU mapped + RU→EN mapped. Handles keyboard layout mistakes.

### `calculateScore(item, query): number`

Weighted relevance scoring:

| Field | Exact Match | Contains | Token Partial |
|-------|-------------|----------|---------------|
| Title | 100 | 50 | 10 |
| User Tags | 80 | — | 15 |
| Hidden Tags | 60 | — | — |
| Content | 40 | 20 | 5 |

---

## 9. Crypto Utilities API

[`shared/lib/crypto.ts`](src/shared/lib/crypto.ts:1)

### `sha256(value: string): Promise<string>`

Web Crypto API SHA-256 digest, returned as hex string.

### `secureCompare(left: string, right: string): boolean`

Timing-safe string comparison — XOR-based, constant-time for equal-length strings.