Master Plan: SmartNotes AI Technical Debt Resolution

This document is an exhaustive plan for removing technical debt, improving reliability, and stabilizing SmartNotes AI. The focus is on strengthening the current architecture — offline-first, delta patches, y-indexeddb, Supabase, and Yjs — while closing vulnerabilities and performance bottlenecks. No new product features are allowed.
0. Hard Rules

    [!WARNING]
    Any deviation from these rules results in PR rejection.

    Verify Everything. If a task cannot be proven by logs, tests, database advisors, or EXPLAIN ANALYZE, it is not considered done.

    No Base64 Anywhere. Base64 is forbidden as storage, diff format, commit payload, or transport for images/canvas. Only Blob, File, ArrayBuffer, and IndexedDB / object storage references are allowed.

    No Silent Fallback. If commit, sync, RPC, or SSR-boundary import fails, the agent must explicitly mark the process as blocked/failed and use retry/backoff instead of silently bypassing the issue.

    Supabase MCP only for dev/staging. Use it only for validation, schema work, and checks. No direct production changes.

    Least Privilege. Enable only the required feature groups: database, edge functions, storage.

    No Hallucinations. Do not invent APIs, versions, files, or framework behavior.

    No Architectural Rewrites. Improve the existing framework; do not redesign the architecture.

    Contracts before Code. Define invariants first, then write code.

    Lightweight Diffs Only. No heavy payloads in the hot path; heavy data is assembled only at commit time.

    Agent Operating Model. Inspect the repo → propose the smallest isolated fix → validate → stop.

1. Architectural Invariants

    Single Source of Truth. The editor is Yjs, offline storage is IndexedDB, and remote synchronization is Supabase.

    Local-First. The user writes locally immediately; offline edits must never be overwritten by remote sync.

    Append-Only / Delta Log. No instant full overwrite; changes must be recorded as operations, deltas, and batch commits.

    Yjs Contract. y-indexeddb is the default persistence layer for every Y.Doc; one Y.Doc per note.

    One Note, One Writer. No competing write paths without version control.

    Race Safety. Local save, sync queue, CRDT updates, and webhook updates must not create race conditions; use idempotency keys, signature verification, retries, out-of-order tolerance, and monotonic versioning.

    Conflict Policy by Data Type. Use CRDT for text; use separate domain-specific merge policies for canvas, media, and pages. If merge is risky, show a conflict copy and require user-assisted resolution.

    Reconnection Flow. Pull → reconcile → push. No blind overwrite of remote state.

    Sync State Machine. saved → dirty → pending save → syncing → synced / conflict / failed

    Release Contract. schemaVersion, releaseId, uiVersion, and modelVersion must stay in sync to prevent version drift.

    Performance Budgets. Set limits on snapshot size, commit frequency, sync backlog, and number of rendered DOM nodes in lists.

2. Text Editor

    Schema-Based Editor. Use only Tiptap/ProseMirror + Yjs bindings; no raw HTML storage and no bare contenteditable.

    Marks. Required minimum: bold, italic, underline, strike, code, link, highlight, subscript, superscript.

    Predictable Formatting. One command = one mark; no unexpected HTML side effects.

    Shortcuts. Ctrl/Cmd+B, I, U, Z, Y; Enter creates a new block, Shift+Enter inserts a line break.

    Do Not Break OS Shortcuts. Override them only if absolutely necessary.

    Relative Positions. Cursors, comments, annotations, and shared selections must use relative positions, not fixed indexes.

    Snapshots Separate from CRDT Stream. Versions and snapshots must be stored separately; CRDT does not provide a linear history in the usual sense.

    Offline UX. When the user comes back online, show the diff of offline changes instead of silently overwriting content.

    Recommended Formatting Set. Bold, italic, underline, strike, code, link, highlight is enough for 90% of notes.

3. Autosave and Data Integrity

Problem: serializeContentSnapshot may collect heavy data on every input, blocking the main thread, and Base64 is completely forbidden.
Implementation Rules

    Separate hot path and commit. The hot path uses a cheap diff/hash, and real binary assembly happens only at commit time.

    No Base64. Canvas/media must be handled only as Blob/File/ArrayBuffer, never as encoded strings.

    Text-Safe Optimization. Text pages may be excluded from the heavy snapshot only if they are covered by a separate dirty trigger or lightweight hash path; otherwise this is not allowed, because it risks data loss.

    Canvas Tracking. Use only metadata such as drawingRevision as the canvas change signal.

    Separate Triggers. Use independent debounce/coalescing events for text input, page reordering, and canvas updates.

    Autosave State. dirty → pending save → syncing → synced / failed, with visible UI status.

4. Supabase Hardening

    RLS Everywhere. RLS is mandatory, and the frontend must use only the publishable key.

    RLS Policies Must Be Simple and Fast. Indexes must cover the columns used in policy checks; heavy checks should be moved into helper functions rather than writing complex per-row logic.

    search_path Pinning. Functions and triggers must have a safe search_path; if possible, use search_path = '' with fully qualified schema references.

    SECURITY DEFINER Only When Necessary. Otherwise use SECURITY INVOKER. If DEFINER is required, the function must live in a private schema, include an auth.uid() check, and revoke EXECUTE from unnecessary roles.

    pgvector / HNSW. HNSW is the default choice; build large indexes outside dashboard timeout, with the proper maintenance parameters.

    Index/Operator Match. match_note_embeddings must use the same operator as the index operator class, for example <=> for vector_cosine_ops.

    Verify Plans. EXPLAIN ANALYZE is mandatory; use auto_explain if needed.

    Database Advisors as a Gate. Warnings about search_path, RLS, and SECURITY DEFINER are not notes; they are blocking signals.

5. Large List Virtualization

    Use @tanstack/react-virtual only where it is actually needed. Do not apply virtualization everywhere.

    Dynamic Height Is Mandatory. Use estimateSize + measureElement(ref); fixed heights are forbidden.

    Stable Keys. Search and filtering must not reset scroll position or item keys.

    Memoization Only After Profiling. Use React.memo with custom comparison only if profiling proves it is a real bottleneck.

    Acceptance Target. 200+ notes must scroll smoothly in a mobile emulator without card jumping.

6. Editor Overlay and SSR Boundaries

    Break Up the Monolith. Modals, headers, toolbars, and sheet panels should be split into separate modules.

    Client-Only Boundaries. Any component that depends on window, document, localStorage, or canvas must be isolated through a client wrapper and loaded with dynamic(..., { ssr: false }).

    Do Not Use suppressHydrationWarning as the Main Strategy. It is an escape hatch, not architecture.

    Fallback Must Be Short and Neutral. Use a lightweight placeholder with no visual noise.

    No Browser APIs in the SSR Path. Otherwise hydration mismatch is expected.

7. Verification and Acceptance Criteria
Automated

    npm run lint.

    npm run typecheck.

    Regression tests for autosave: canvas-only changes, page reordering only, metadata-only changes.

Manual / Architecture Checks

    Change only the canvas, close the editor, reopen it — data is preserved.

    Reorder pages — autosave triggers, and no unnecessary content is sent.

    Verify queue/sync/CRDT reconnect behavior — local changes are not lost.

    Scroll through 200+ notes — smooth scrolling, no jumping.

    Canvas and browser-only UI load only on the client, and hydration errors do not appear.

    EXPLAIN ANALYZE proves Index Scan, not Sequential Scan.

    Advisors do not report issues with search_path, RLS, or SECURITY DEFINER.

8. What Must Never Happen

    Never use Base64.

    Never use full overwrite instead of delta/append-only.

    Never hide errors with silent fallback.

    Never change architecture for cosmetic reasons.

    Never mark a task complete without evidence.

    Never build the editor on raw HTML.

    Never assume “the index exists, so it is used.”

    Never allow competing write paths for the same note.

Autosave Hardening

Autosave must work as an append-only pipeline: use a fast dirty/hash check in the hot path, debounce and coalesce frequent edits, and build the heavy snapshot only at commit time. Any blob/media/canvas data must be transmitted only in binary form, without Base64; commits must be idempotent, with retry/backoff and explicit failed/conflict states, and reconnect must follow pull → reconcile → push without blind overwriting local edits.

в супабазе лучше сделать так, как лучше будет и чище, короче уже делаем "начисто" так что лишниго ничего не должно будет остатся. то есть:
Сделать «начисто» в контексте нашего плана означает следующее:

    Создать новый файл миграции (как и планировалось).

    Использовать CREATE OR REPLACE FUNCTION. Эта команда элегантно и полностью перезапишет старые, уязвимые функции на новые (с правильным search_path = '' и явным указанием схем).

    Никаких дублей. Старый код функций будет уничтожен внутри самой базы данных, не оставив после себя никакого «мусора» или конфликтующих правил.