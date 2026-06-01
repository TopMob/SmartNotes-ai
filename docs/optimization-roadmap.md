# Product Optimization Roadmap

## Goal

Maximize SmartNotes performance and responsiveness without expanding the AI agent scope yet.

Priority areas:

1. data loading;
2. search;
3. note save path;
4. large list rendering;
5. editor cost;
6. backend query/index stability.

---

## Already Completed

### 1. Search input and UI search pressure reduction

- Added debounced semantic search trigger.
- Kept lexical search immediate for fast perceived response.
- Reduced repeated search score calculations.
- Reduced extra UI work in command palette and AI chat rendering.

Relevant areas:

- `src/features/app-shell/ui/components/Header.tsx`
- `src/features/notes/model/note-selectors.ts`
- `src/features/app-shell/ui/components/CommandPalette.tsx`
- `src/features/ai-engine/ui/AiChatPanel.tsx`
- `src/features/app-shell/ui/components/MainSurface.tsx`

### 2. Unified semantic pipeline

- Standardized semantic retrieval on `public.note_embeddings`.
- Removed the deprecated `public.notes.embedding` runtime path from local code.
- Added semantic search API route for app search.
- Added semantic matches block in the main UI.

Relevant areas:

- `src/app/api/search/semantic/route.ts`
- `src/features/app-shell/ui/smart-notes-shell.tsx`
- `src/features/app-shell/ui/components/MainSurface.tsx`
- `supabase/migrations/20260530120000_unify_note_embeddings_pipeline.sql`

### 3. Lightweight notes list + full note details split

- `notes` list queries no longer fetch `note_pages(*)` for the whole app shell.
- Added separate note detail fetching for editor/detail flows.
- Preserved optimistic updates and mutation compatibility.

Relevant areas:

- `src/features/notes/api/notes-repository.ts`
- `src/features/notes/hooks/use-notes-query.ts`
- `src/features/notes/hooks/use-note-mutations.ts`
- `src/features/app-shell/ui/smart-notes-shell.tsx`
- `src/shared/lib/react-query/query-keys.ts`

---

## Next Best Steps

### Phase 1. Optimize note save path

Current issue:

- `patch.pages` still uses a heavy replace strategy for `note_pages`.
- This creates unnecessary writes and network/database load during editing.

Recommended work:

1. Replace `delete all + insert all` with page diff logic.
2. Split page writes into:
   - update existing pages;
   - insert new pages;
   - delete removed pages.
3. Avoid sending `pages` when only metadata changed.
4. Keep the current durable save behavior, but reduce write amplification.

Primary files:

- `src/features/notes/api/notes-repository.ts`
- `src/features/editor-collab/hooks/use-durable-note-save.ts`
- `src/features/notes/lib/note-utils.ts`

### Phase 2. Harden search backend

Recommended work:

1. Verify and improve `match_note_embeddings` performance path.
2. Ensure indexing supports the real runtime query path.
3. Add or confirm useful relational indexes for common list and filter queries.
4. Consider a future server-side hybrid search endpoint that merges lexical and semantic ranking.

Primary areas:

- RPC `match_note_embeddings`
- `src/app/api/search/semantic/route.ts`
- `src/app/api/ai/chat/route.ts`
- Supabase indexes and migrations

### Phase 3. Reduce large-list rendering cost

Recommended work:

1. Add virtualization/windowing for note lists and grids.
2. Check `NoteCard` and list-level rerender frequency.
3. Scale down heavy shadows/blur/transitions on low-power/mobile paths where helpful.

Primary file:

- `src/features/app-shell/ui/components/MainSurface.tsx`

### Phase 4. Decompose editor surface

Recommended work:

1. Split `EditorOverlay` into smaller subtrees.
2. Lazy mount heavy subpanels/tools.
3. Reduce rerender surfaces around current page/editor state.

Primary file:

- `src/features/app-shell/ui/components/EditorOverlay.tsx`

### Phase 5. Query and polling cleanup

Recommended work:

1. Revisit polling frequency.
2. Use focus-aware and visibility-aware refetching where appropriate.
3. Tune stale times and invalidation behavior.

Primary areas:

- `src/features/app-shell/ui/smart-notes-shell.tsx`
- query hooks across notes/folders/settings/invites

### Phase 6. Supabase hardening

Recommended work:

1. Fix function `search_path` warnings.
2. Review `SECURITY DEFINER` usage.
3. Re-run advisors after DB changes.

This is mostly reliability/security debt, but it matters before broader backend expansion.

---

## Suggested Execution Order

1. optimize `note_pages` save path;
2. improve semantic/relational DB indexing and search RPC path;
3. virtualize note rendering for scale;
4. decompose `EditorOverlay`;
5. clean polling/query behavior;
6. Supabase hardening pass.

---

## Practical Rule For Future Work

When choosing between UI polish and data-path improvements, prefer data-path improvements first.

For this project, the highest-value optimization order is:

1. reduce payload;
2. reduce write amplification;
3. reduce expensive queries;
4. reduce rerenders;
5. then polish visuals and interaction details.
