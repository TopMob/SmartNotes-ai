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
Note content changes → useAutoAnalyze hook (debounced)
  → POST /api/ai/analyze { noteId, title, content, userTags, folderContext }
  → Server: authenticate user (cookie) or admin (x-secret header)
  → Set ai_status = "analyzing" in Supabase
  → OpenRouter LLM call → parse JSON result
  → Update note: user_tags, hidden_tags, folder_id, ai_relevance, resurfacing_class, ai_status = "done"
  → Client: ai-store updates status
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
| BYOS over Supabase Storage | User owns their data, no storage quota costs |
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

## 8. AI as Pipeline

The AI engine operates as a **pipeline**, not a single call:

1. Note content changes → `aiStatus = "pending"`
2. Auto-analyze hook debounces and triggers `/api/ai/analyze`
3. Server calls OpenRouter LLM → generates `userTags`, `hiddenTags`, `folderId`, `relevance`, `resurfacingClass`
4. Results written back to Supabase → `aiStatus = "done"`
5. Future: embeddings pipeline → `note_embeddings` → vector retrieval

---

## 9. BYOS (Bring Your Own Storage)

User media files are stored on the **user's own Google Drive**, not in the project's Supabase Storage. Notes contain only reference `MediaDescriptor` objects with `fileId`, `url`, and `thumbnailUrl`. Upload flows through a Next.js proxy route.

---

## 10. Zero-Knowledge Lock

Note locking uses **client-side SHA-256** hashing with salt. The password never leaves the client. Locked note content is masked with a placeholder until the correct password is verified via `secureCompare` (timing-safe).