# SmartNotes-AI — Codebase Review & Improvement Plan

## Overview

Full audit of the SmartNotes-AI repository — a Next.js 16 + Supabase + Yjs note-taking app with AI-powered semantic search, offline-first sync, and BYOS media storage. The review covers bugs, security, architecture, performance, code quality, and missing spec features.

---

## 1. CRITICAL BUGS

### 1.1 Dead code in AI queue — `readPendingNoteIds` returns `undefined`

**File:** [`ai-queue.ts`](src/services/ai/ai-queue.ts:16)

```ts
// line 16-17
  } catch {
    return;   // ← returns undefined
    return []; // ← unreachable dead code
  }
```

`readPendingNoteIds()` can return `undefined` instead of `string[]`. The `new Set<string>(undefined)` call will throw at runtime. The second `return []` is unreachable.

**Fix:** Remove the stray `return;` on line 16.

---

### 1.2 Supabase browser client created on every repository call

**Files:**
- [`notes-repository.ts`](src/features/notes/api/notes-repository.ts:20)
- [`folders-repository.ts`](src/features/folders/api/folders-repository.ts:18)
- [`settings-repository.ts`](src/features/settings/api/settings-repository.ts:14)
- [`auth-client.ts`](src/features/auth/api/auth-client.ts:19)

Every method calls `createSupabaseBrowserClient()` which invokes `createBrowserClient()` from `@supabase/ssr` each time. This creates a new Supabase client instance per call, causing:

- Multiple Realtime connections that are never cleaned up
- Redundant auth token refresh cycles
- Memory leaks from unclosed connections
- Race conditions between concurrent calls using different client instances

**Fix:** Create a singleton browser client. Replace the per-call pattern with a module-level lazy singleton:

```ts
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const url = getSupabaseUrl();
    const key = getSupabasePublishableKey();
    if (!url || !key) return null;
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}
```

Then use `getSupabaseBrowserClient()` everywhere instead of `createSupabaseBrowserClient()`.

---

### 1.3 PWA manifest theme_color mismatch

**Files:** [`manifest.ts`](src/app/manifest.ts:12) vs [`layout.tsx`](src/app/layout.tsx:35)

- `manifest.ts`: `theme_color: "#7c3aed"` — purple
- `layout.tsx`: `themeColor: "#f7f3ea"` — beige

These must match for a consistent PWA install experience.

**Fix:** Align both to the same value. The default CSS `:root` uses a dark theme, so `#050505` background with `#00f2ff` accent would be more accurate, or pick one and use it consistently.

---

### 1.4 `useNoteActions` creates hidden query subscription

**File:** [`use-note-mutations.ts`](src/features/notes/hooks/use-note-mutations.ts:204)

```ts
export function useNoteActions() {
  const notes = useNotesQuery().data ?? [];  // ← creates a query subscription
  function findNote(noteId: string) {
    return notes.find((item) => item.id === noteId) ?? null;
  }
```

`useNoteActions` is called from multiple components. Each call creates a new TanStack Query subscription via `useNotesQuery()`. The `findNote` helper should use `queryClient.getQueryData()` instead of subscribing to the query.

**Fix:** Replace `useNotesQuery()` with `useQueryClient().getQueryData<Note[]>(queryKeys.notes(userId))`.

---

## 2. SECURITY ISSUES

### 2.1 SHA-256 without salt for lock passwords

**File:** [`lock-service.ts`](src/features/lock-center/lib/lock-service.ts:13)

```ts
hash: await sha256(normalized),
```

Plain SHA-256 without a per-note salt is vulnerable to rainbow table attacks. If an attacker gains access to the stored data, they can pre-compute hashes for common passwords.

**Fix:** Generate a random salt per note and store `hash: sha256(salt + normalized)`. Update the `NoteLock` type to include a `salt` field.

---

### 2.2 CORS wildcard on AI analyze route

**File:** [`route.ts`](src/app/api/ai/analyze/route.ts:19)

```ts
"Access-Control-Allow-Origin": "*",
```

Combined with the `x-secret` header, this allows any origin to call the AI endpoint if they obtain the secret. Should restrict to known frontend origins.

**Fix:** Use an allowlist from environment variable, e.g. `ALLOWED_ORIGINS=https://smartnotes.app,http://localhost:3000`.

---

### 2.3 Real credentials in `.env.example`

**File:** [`.env.example`](.env.example:1)

```
NEXT_PUBLIC_SUPABASE_URL=https://ammpwqfcutlyrjcarubc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pejoS35DKwm9-QOFiNU0Sg_R0HJ3qVb
```

Contains what appears to be a real Supabase project URL and key. Even though publishable keys are public by design, the project URL should not be in version control.

**Fix:** Replace with placeholder values like `https://your-project.supabase.co` and `your-publishable-key`.

---

### 2.4 `secureCompare` leaks length information

**File:** [`crypto.ts`](src/shared/lib/crypto.ts:11)

```ts
if (left.length !== right.length) {
  return false;
}
```

The early return on length mismatch leaks timing information. For a note lock this is low-risk, but the function name implies constant-time comparison.

**Fix:** Either rename to `compareHashes` with a doc comment noting the limitation, or implement a true constant-time compare that always iterates the longer string length.

---

## 3. ARCHITECTURE ISSUES

### 3.1 `SmartNotesShell` is a 304-line god component

**File:** [`smart-notes-shell.tsx`](src/features/app-shell/ui/smart-notes-shell.tsx:31)

The component has:
- 30+ hook calls
- 15+ local state variables
- All sidebar/editor/sheet/filter logic inline
- Inline event handlers passed as props causing child re-renders

**Fix:** Extract into focused sub-hooks and components:
- `useAppShellState()` — sidebar, viewport, sheet state
- `useNoteInteractions()` — openNote, createNoteDraft, closeEditor
- `useReminderEffects()` — reminder scheduling and notification logic
- Move inline handlers to `useCallback` or extract to custom hooks

---

### 3.2 Sync queue has no consumer

**File:** [`sync-queue.ts`](src/services/sync/sync-queue.ts)

Items are enqueued via `enqueueSyncItem` but there is no code that processes the queue when coming back online. The queue is write-only — items accumulate in localStorage forever.

**Fix:** Implement a sync processor that:
1. Listens to `online` event and `visibilitychange`
2. Processes queued items in order
3. Retries with exponential backoff on failure
4. Removes completed items from the queue
5. Publishes `syncCompleted` events

---

### 3.3 AI queue has no consumer

**File:** [`ai-queue.ts`](src/services/ai/ai-queue.ts)

`scheduleAiAnalysis` adds note IDs to a Set in localStorage, but no code reads the queue and sends notes to `/api/ai/analyze`. The queue is write-only.

**Fix:** Implement an AI queue processor that:
1. Debounces analysis requests per note
2. Batches pending notes
3. Calls `/api/ai/analyze` with note data
4. Updates note `aiStatus` through the pipeline
5. Calls `markAiAnalysisDone` on completion

---

### 3.4 No Realtime subscriptions for data changes

The spec requires "Realtime обновления между устройствами через Supabase Channels", but there are no Supabase Realtime subscriptions for notes, folders, or settings. Only the editor-collab channel exists for Yjs sync.

**Fix:** Add Realtime subscriptions in the data bootstrap layer:
- Subscribe to `notes` table changes for the current user
- Subscribe to `folders` table changes
- Invalidate TanStack Query cache on incoming changes
- Handle conflict resolution for concurrent edits

---

### 3.5 No React error boundaries

There are no error boundaries anywhere in the app. A runtime error in any component crashes the entire UI with a white screen.

**Fix:** Add at minimum:
- A root error boundary in `layout.tsx`
- An editor error boundary around `EditorOverlay`
- A shell error boundary around `SmartNotesShell`

---

### 3.6 Module-level mutable state in services

**Files:**
- [`sync-queue.ts`](src/services/sync/sync-queue.ts:42): `const queue: SyncQueueItem[] = readPersistedQueue();`
- [`ai-queue.ts`](src/services/ai/ai-queue.ts:32): `const pendingNoteIds = new Set<string>(readPendingNoteIds());`
- [`reminder-service.ts`](src/services/reminders/reminder-service.ts:2): `const timers = new Map<string, ...>()`

These are initialized once at module load. If localStorage changes from another tab, the in-memory state becomes stale. In development with React Strict Mode, effects run twice, potentially causing duplicate timers.

**Fix:** Consider making these lazy-initialized or add cross-tab sync via `storage` event listener.

---

## 4. PERFORMANCE ISSUES

### 4.1 No pagination in notes repository

**File:** [`notes-repository.ts`](src/features/notes/api/notes-repository.ts:26)

```ts
const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
```

Fetches ALL notes with `select("*")` and no limit. As the note count grows, this becomes a performance and memory bottleneck. The spec explicitly requires server-side pagination.

**Fix:** Implement cursor-based or offset pagination:
- Add `range` parameter to `notesRepository.list()`
- Use Supabase `.range(from, to)` for server-side pagination
- Implement infinite scroll with TanStack Query's `useInfiniteQuery`
- Keep client-side `displayLimit` as a display layer concern

---

### 4.2 `scheduleReminder` called for ALL notes on every change

**File:** [`smart-notes-shell.tsx`](src/features/app-shell/ui/smart-notes-shell.tsx:125)

```ts
useEffect(() => {
  notes.forEach((note: Note) => scheduleReminder(note.id, note.reminderAt));
}, [notes]);
```

This clears and recreates ALL reminder timers whenever any note changes. With 1000 notes, a single character edit triggers 1000 `clearTimeout` + `setTimeout` calls.

**Fix:** Diff the previous and current reminder map, only updating changed/cancelled reminders.

---

### 4.3 Tiptap extensions array recreated every render

**File:** [`EditorOverlay.tsx`](src/features/app-shell/ui/components/EditorOverlay.tsx:64)

```ts
const editor = useEditor({
  extensions: [
    StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false } }),
    LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
  ],
```

The extensions array is recreated on every render, which can cause Tiptap to reinitialize the editor.

**Fix:** Extract the extensions array to a module-level constant or memoize it with `useMemo`.

---

### 4.4 `tagOptions` computed from all notes on every render

**File:** [`smart-notes-shell.tsx`](src/features/app-shell/ui/smart-notes-shell.tsx:84)

```ts
const tagOptions = useMemo(
  () => Array.from(new Set(notes.flatMap((note: Note) => note.userTags))).sort(...),
  [notes],
);
```

This flattens all tags from all notes. While `useMemo` helps, the dependency on `notes` means it recomputes on any note change. For large collections, this is expensive.

**Fix:** Compute tag options at the repository/query level and cache separately.

---

## 5. CODE QUALITY ISSUES

### 5.1 Inconsistent error handling across repositories

- [`notes-repository.ts`](src/features/notes/api/notes-repository.ts:28): throws on Supabase error
- [`settings-repository.ts`](src/features/settings/api/settings-repository.ts:22): silently falls back to local storage on Supabase error

This inconsistency makes debugging difficult and hides failures.

**Fix:** Adopt a consistent strategy: log the error, then fall back to local. Or throw and let the mutation's `onError` handle it.

---

### 5.2 Mixed Russian/English in error messages

- [`auth-client.ts`](src/features/auth/api/auth-client.ts:22): `"Supabase runtime config не задан. Email-вход недоступен в локальном режиме."`
- [`lock-service.ts`](src/features/lock-center/lib/lock-service.ts:8): `"PASSWORD_REQUIRED"`
- [`local-notes-repository.ts`](src/features/notes/api/local-notes-repository.ts:34): `"Local note ${noteId} not found."`

**Fix:** Use the i18n system (`src/shared/lib/i18n.ts`) for all user-facing messages. Keep internal error codes in English.

---

### 5.3 Unsafe JSON type casting in mappers

**File:** [`note-mappers.ts`](src/features/notes/api/note-mappers.ts:8)

```ts
function asPages(value: Json): NotePage[] {
  return Array.isArray(value) ? (value as NotePage[]) : [];
}
```

No runtime validation — a malformed JSON from Supabase will produce objects that satisfy TypeScript but crash at runtime when accessing expected properties.

**Fix:** Use a runtime validation library like `zod` for critical mappers, or at minimum add property existence checks.

---

### 5.4 `normalizeNotePatch` uses spread-with-null trick

**File:** [`note-utils.ts`](src/features/notes/lib/note-utils.ts:99)

```ts
return {
  ...patch,
  updatedAt: nowIso(),
  ...(analysisPending ? { aiStatus: "pending", ... } : null),
};
```

Spreading `null` is a JS quirk that works but is confusing and not type-safe.

**Fix:** Use explicit conditional: `...(analysisPending ? { ... } : {})`.

---

### 5.5 All dependencies use `latest` tag

**File:** [`package.json`](package.json:14)

Almost all dependencies use `"latest"` instead of pinned versions. This makes builds non-reproducible.

**Fix:** Run `npm install` to resolve versions, then commit the exact versions from `package-lock.json`. Or explicitly pin each dependency.

---

### 5.6 Missing Tiptap extensions for declared editor tools

**File:** [`package.json`](package.json:13)

The `EditorToolKey` type in [`types.ts`](src/entities/settings/model/types.ts:13) includes `"underline"` but `@tiptap/extension-underline` is not in dependencies. Similarly, media insertion requires `@tiptap/extension-image` which is also missing.

**Fix:** Add `@tiptap/extension-underline` and `@tiptap/extension-image` to dependencies.

---

## 6. MISSING SPEC FEATURES

These are features defined in [`SmartNotes_Features.txt`](SmartNotes_Features.txt) and [`SmartNotes_Structure.txt`](SmartNotes_Structure.txt) that have no implementation:

| # | Feature | Spec Section | Status |
|---|---------|-------------|--------|
| 1 | Offline sync consumer | 4.5 Offline/Sync | Queue exists, no processor |
| 2 | AI pipeline execution | 4.4 AI Engine | Plan created, no execution |
| 3 | Vector/semantic search | 4.4 / 5 | Full-text only, no pgvector |
| 4 | Canvas drawing overlay | 9 Canvas Drawing | No implementation |
| 5 | Math resolver | 7 Editor Smart Logic | No implementation |
| 6 | Paste sanitization | 7 Editor Smart Logic | No implementation |
| 7 | Google One Tap sign-in | 1 Auth | No implementation |
| 8 | PWA offline shell | 5 Infrastructure | Service worker is a no-op |
| 9 | Drag-and-drop folder sort | 3 Folders | No implementation |
| 10 | Note import/export | — | No implementation |
| 11 | Admin reindex | 10 AI Engine | No implementation |
| 12 | Feedback loop from manual moves | 4.4 AI Engine | Partial — `manual-folder-signal` tag exists but no AI feedback |

---

## 7. PROPOSED ACTION PLAN

Priority-ordered implementation checklist:

### Phase 1 — Critical Fixes

- [ ] Fix dead code bug in `ai-queue.ts` `readPendingNoteIds`
- [ ] Implement Supabase browser client singleton
- [ ] Align PWA manifest and layout theme colors
- [ ] Remove real credentials from `.env.example`
- [ ] Restrict CORS on AI analyze route
- [ ] Add salt to note lock hashing

### Phase 2 — Architecture & Performance

- [ ] Refactor `SmartNotesShell` into focused hooks and sub-components
- [ ] Replace `useNotesQuery()` in `useNoteActions` with `queryClient.getQueryData`
- [ ] Add server-side pagination to notes repository
- [ ] Optimize reminder scheduling — diff instead of full rebuild
- [ ] Memoize Tiptap extensions array
- [ ] Add React error boundaries — root, shell, editor

### Phase 3 — Sync & AI Pipeline

- [ ] Implement sync queue consumer with online detection and retry
- [ ] Implement AI queue consumer with debounce and batch processing
- [ ] Add Supabase Realtime subscriptions for notes/folders/settings
- [ ] Wire AI pipeline stages — extract, chunk, embed, classify, rank, persist

### Phase 4 — Code Quality

- [ ] Pin all dependency versions in `package.json`
- [ ] Add `@tiptap/extension-underline` and `@tiptap/extension-image`
- [ ] Standardize error handling strategy across repositories
- [ ] Move user-facing strings to i18n system
- [ ] Add runtime validation to JSON mappers with zod
- [ ] Fix `normalizeNotePatch` spread-with-null pattern
- [ ] Add cross-tab sync for module-level service state

### Phase 5 — Missing Features

- [ ] Implement PWA offline shell with cache strategies in service worker
- [ ] Implement canvas drawing overlay component
- [ ] Implement math resolver editor module
- [ ] Implement paste sanitization for HTML content
- [ ] Implement Google One Tap sign-in
- [ ] Implement drag-and-drop folder sorting
- [ ] Implement vector/semantic search with pgvector
- [ ] Implement admin reindex tool
