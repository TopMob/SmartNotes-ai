# Architecture

> SmartNotes AI — system design, data flows, and key design decisions.

---

## 1. Architectural Pattern: Feature-Sliced Domain-Driven Design (FSDDD)

The project follows a **feature-sliced** architecture where each feature module encapsulates its own:

- **API layer** — repository classes, mappers, server actions
- **Hooks** — React Query hooks for data fetching and mutations
- **Model** — Zustand stores, types, selectors
- **UI** — React components specific to the feature
- **Lib** — pure utility functions

Cross-feature dependencies flow **inward**: features may depend on `entities` and `shared`, but never on other features directly. Shared state is coordinated via the [`EventBus`](src/services/event-bus.ts) and Zustand stores.

---

## 2. Offline-First Architecture

- **IndexedDB** (`y-indexeddb`) persists Yjs documents locally
- **LocalStorage** serves as a backup for Yjs updates
- **Sync Queue** ([`sync-queue.ts`](src/services/sync/sync-queue.ts)) buffers mutations when offline
- **Sync Consumer** ([`sync-consumer.ts`](src/services/sync/sync-consumer.ts)) processes the queue when connectivity is restored
- **Durable Save** ([`use-durable-note-save.ts`](src/features/editor-collab/hooks/use-durable-note-save.ts)) debounces and retries saves with fallback

---

## 3. Partial Updates

All note and settings mutations send **only the changed fields** (delta patches), not full objects. This reduces bandwidth and avoids overwriting concurrent changes.

---

## 4. Data Flows

### 4.1 Authentication Flow

```
Browser → /api/supabase/config (runtime config: Supabase URL, keys, Google Client ID)
         → Google One Tap / OAuth / Email login
         → /auth/callback (code exchange → session cookies)
         → AuthProvider (session sync → profile bootstrap → auth store)
         → Middleware (session refresh + redirect unauthenticated to /login)
```

### 4.2 Note Editing Flow

```
User opens note → NoteCollabSessionProvider
  → Y.Doc created → IndexedDB provider attached (offline persistence)
  → Supabase Realtime channel created → Yjs CRDT sync
  → Query snapshot hydrates Y.Doc (600ms fallback)
  → Tiptap editor bound to Y.Doc
  → Durable save: debounce 3s → patch update to Supabase
  → LocalStorage backup for unsaved Yjs updates
```

### 4.3 AI Analysis Flow

```
Note content changes / App boots
  → DataBootstrap monitors notes → identifies unanalyzed notes (analyzed === false)
  → Enqueues note ID via scheduleAiAnalysis(noteId) → persisted in localStorage ('smartnotes:ai:pending')
  → ai-queue processes sequentially with a 1.5s delay (prevents rate limits)
  → POST /api/ai/analyze { noteId }
  → Server: authenticate user (cookie) or admin (x-secret header)
  → Set ai_status = "analyzing" in Supabase
  → OpenRouter LLM call (GPT-4o-mini) → parse JSON result
  → Update note: user_tags, hidden_tags, folder_id, ai_relevance, resurfacing_class, ai_status = "done"
  → Client: removes note from queue → EventBus publishes syncCompleted → React Query invalidates cache
```

### 4.4 Search Flow

```
User types query → search-store
  → search-engine: normalize, fixLayout (RU↔EN keyboard mapping), calculateScore
  → Weighted scoring: title (100/50), userTags (80), hiddenTags (60), content (40/20)
  → Results filtered and sorted by score
  → Future: hybrid search with pgvector embeddings
```

### 4.5 Event Bus Flow

```
Internal events (typed):
  reminderTriggered → Reminder service → notification
  syncQueued → Sync consumer → Supabase upsert
  syncCompleted / syncFailed → UI feedback
  feedbackSubmitted → Feedback API → Supabase insert
  noteImported → UI toast
  toast → Global toast display
```

---

## 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js App Router | Modern SSR, file-based routing, server components, API routes |
| Yjs CRDT over custom sync | Conflict-free collaborative editing without central coordination |
| Supabase over raw Postgres | Auth, realtime, storage, and pgvector in one platform |
| OpenRouter over direct OpenAI | Multi-model access, cost optimization, single API |
| Zustand over Redux | Lightweight, minimal boilerplate, good with React Query |
| TanStack Query over manual fetch | Cache management, optimistic updates, pagination |
| Cloud Media Storage | Supabase Storage as primary default, with optional bypassable Google Drive (BYOS) integration |
| Client-side SHA-256 over server hashing | Zero-knowledge: password never transmitted |
| IndexedDB over localStorage for Yjs | Structured, larger capacity, async, transactional |
| Event Bus over prop drilling | Decoupled cross-feature communication |

---

## 6. Middleware & Routing

[`middleware.ts`](src/middleware.ts) handles:

- **Session refresh** — `updateSupabaseSession` refreshes auth cookies on every request
- **Auth guard** — unauthenticated users redirected to `/login` (except `/api/*`, `/auth/*`, `/login`)
- **Authenticated redirect** — logged-in users on `/login` redirected to `/`

Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and static asset files.

---

## 7. Provider Hierarchy

```
RootLayout
  └─ AppProviders
      ├─ QueryClientProvider (TanStack Query)
      ├─ RootErrorBoundary
      ├─ AuthProvider (session boot, Google GIS, guest mode, watchdog timeout)
      │   └─ DataBootstrap (runtime config, initial data load)
      │       ├─ PwaRegister
      │       ├─ ThemeBridge (CSS custom properties from settings)
      │       └─ {children} → AppEntry → SmartNotesShell
```

[`AuthProvider`](src/features/auth/ui/auth-provider.tsx) implements a **watchdog timeout** (8 seconds). If auth bootstrap exceeds this, the app enters a **degraded mode** with limited functionality.

---

## 8. AI as Pipeline (Background AI Queue)

The AI engine operates as a robust **sequential pipeline**, managed globally to ensure stability and respect external API rate limits:

1. **Detection & Enqueuing**: As notes are created or updated, the application sets `analyzed = false` and `aiStatus = "idle"`.
2. **Global Monitoring**: `DataBootstrap` continuously observes the notes cache. Any unanalyzed notes are automatically added to the queue via `scheduleAiAnalysis(noteId)`.
3. **Queue Management**: The queue is stored in `localStorage` under `smartnotes:ai:pending` to survive session restarts or browser crashes, processing tasks sequentially.
4. **Execution**: The background queue handler makes sequential POST calls to `/api/ai/analyze` with an enforced **1.5s delay** between them.
5. **LLM & Semantic Classification**: The Next.js API endpoint delegates to the Supabase Deno Edge Function, which prompts OpenRouter to extract semantic summaries (`aiInsight`), `userTags`, `hiddenTags`, maps the closest folder (`match_folder` RPC), and determines `relevance` / `resurfacingClass`.
6. **Vector Generation**: Text embeddings are generated and stored in `note_embeddings` for future semantic hybrid search.
7. **Cache Invalidation & Reactive UI**: Upon completion, the note is removed from the queue, `syncCompleted` is dispatched over the `EventBus`, and React Query invalidates the notes query cache, instantly and seamlessly updating the user interface.

---

## 9. Cloud Media Storage & Image Compression (Zero-Base64)

User media files are uploaded to **Supabase Storage** (the `note-images` bucket) by default.
To minimize bandwidth and cloud storage usage, images are compressed client-side using a zero-dependency HTML5 Canvas utility to high-quality JPEGs under 500KB before uploading.
Alternatively, users can configure an optional **Google Drive (BYOS)** integration to save files directly to their personal Drive accounts. Users can completely disable Google Drive in settings at any time, forcing the application to instantly fall back to Supabase Storage.

### Zero-Base64 Offline & Guest Fallback
If the user is unauthenticated (guest session) or offline, the compressed image is saved directly as a **binary Blob in IndexedDB** (DB name: `smartnotes-local-media`) under a unique `fileId` key.
- The note JSON/HTML content stores **only a clean string ID** (`local-media:fileId`), keeping the database size tiny and avoiding `localStorage` quota limits.
- A custom Tiptap NodeView (`LocalMediaImageExtension`) intercepts `local-media:fileId` URLs at runtime, asynchronously loads the binary Blob from IndexedDB, and exposes it using a temporary session-only object URL (`URL.createObjectURL(blob)`), which is revoked on destroy to avoid memory leaks.
- **Base64 Auto-Migration**: If any old notes containing inline Base64 data URLs (`data:image/...`) are loaded into the editor, they are automatically parsed, converted to Blobs, saved to IndexedDB, and rewritten to `local-media:fileId` references, purging legacy Base64 from database notes permanently.

---

## 10. Zero-Knowledge Lock

Note locking uses **client-side SHA-256** hashing with salt. The password never leaves the client. Locked note content is masked with a placeholder until the correct password is verified via `secureCompare` (timing-safe).

---

## 11. Database Security (Supabase Hardening)

To ensure the safety of user data at the API level, the Supabase PostgreSQL database is hardened against unintended access:
- **SECURITY DEFINER Functions**: All such functions explicitly clear their search path (`SET search_path TO ''`) to prevent search path injection attacks.
- **RPC Authorization**: Custom RPC functions (`match_folder`, `get_or_create_system_folder`) that require elevated privileges enforce strict `auth.uid()` checks internally and are only executable by the `authenticated` role (`REVOKE EXECUTE FROM anon`).
- **Trigger Isolation**: Internal database triggers and utility functions have `EXECUTE` revoked from `public`, `anon`, and `authenticated` roles entirely, making them invisible to the PostgREST API.
- **Database Advisors Gate**: The database architecture is enforced to strictly pass all Supabase Security Advisor checks.