# Implementation Status

> Current progress of SmartNotes AI implementation by module.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ **Done** | Implemented and working |
| 🔶 **Skeleton** | File/logic exists but incomplete |
| ❌ **Not started** | Fully absent |
| 🐛 **Bug / Fixed** | Error found and fixed |

---

## Fixed Bugs (Recent Session)

| File | Bug | Status |
|------|-----|--------|
| [`bind-yjs-supabase-channel.ts`](src/features/editor-collab/lib/bind-yjs-supabase-channel.ts) | `channel.send()` called before SUBSCRIBED → Realtime fell back to REST → `POST /rest/v1/notes?select=* 403` | ✅ Fixed: buffering until SUBSCRIBED |
| [`use-durable-note-save.ts`](src/features/editor-collab/hooks/use-durable-note-save.ts) | `scheduleSave()` called **after** `return` (dead code) — save didn't work | ✅ Fixed: moved before return |
| [`use-note-mutations.ts`](src/features/notes/hooks/use-note-mutations.ts) (create) | On error, `invalidateQueries` deleted optimistic note → editor closed | ✅ Fixed: optimistic note preserved on error |

### Bug chain: "editor closes on note creation error"

```
createNoteDraft()
  → optimisticNote added to cache
  → editor opens (currentNoteId = note.id)
  → notesRepository.create() → POST /rest/v1/notes?select=* → 403
    (Supabase Realtime channel.send() REST fallback — before SUBSCRIBED)
  → onError: invalidateQueries → cache reset → optimisticNote gone
  → currentNote = null → editorOpen && !currentNote → editor doesn't render
  → editor closed
```

---

## 1. Auth & Session

| Task | Status | Notes |
|------|--------|-------|
| Google OAuth / One Tap | ✅ | [`login-shell.tsx`](src/features/auth/ui/login-shell.tsx) |
| Email + password login/register | ✅ | [`login-shell.tsx`](src/features/auth/ui/login-shell.tsx) |
| Reset password flow | ✅ | [`login-shell.tsx`](src/features/auth/ui/login-shell.tsx) |
| Popup → redirect fallback | ✅ | Implemented |
| Safe logout | ✅ | In auth hooks |
| Display name change | 🔶 | `profiles` in DB, no UI |
| Avatar upload/update | 🔶 | `avatar_url` in DB, no UI |
| Bootstrap config endpoint | ✅ | [`data-bootstrap.tsx`](src/features/bootstrap/ui/data-bootstrap.tsx) |
| Degraded auth mode | 🔶 | Skeleton in shell |
| Cooldown for repeated Google prompt | ❌ | |
| Copy UID | ❌ | |

---

## 2. Notes Core

| Task | Status | Notes |
|------|--------|-------|
| Note CRUD | ✅ | [`notes-repository.ts`](src/features/notes/api/notes-repository.ts), [`use-note-mutations.ts`](src/features/notes/hooks/use-note-mutations.ts) |
| Trash / restore / permanent delete | ✅ | Mutations implemented |
| Multi-page notes | ✅ | `note_pages` in schema, `buildPageAddPatch` |
| Page navigation | ✅ | [`EditorOverlay.tsx`](src/features/app-shell/ui/components/EditorOverlay.tsx) — Prev/Next |
| Add page | ✅ | `addPage()` in toolbar |
| Delete page | 🔶 | `buildPageDeletePatch` exists, no UI button |
| Pin / Favorite / Archive | ✅ | |
| Reminders | ✅ | [`reminder-service.ts`](src/services/reminders/reminder-service.ts) |
| Auto-title generation | ✅ | DB trigger + `deriveTitle` |
| Note pagination | ✅ | [`use-notes-query.ts`](src/features/notes/hooks/use-notes-query.ts) |
| Inline media images | ✅ | `handleAttachImage` in EditorOverlay |
| Read `note_pages` from DB | ✅ | Implemented in `mapNoteRow` |
| Scroll position preservation | ❌ | |

---

## 3. Editor

| Task | Status | Notes |
|------|--------|-------|
| Tiptap editor | ✅ | [`EditorOverlay.tsx`](src/features/app-shell/ui/components/EditorOverlay.tsx) |
| Toolbar (bold/italic/strike) | ✅ | |
| Underline | ✅ | Extension added, toolbar button works |
| Structural blocks (lists, hr) | ✅ | |
| Text alignment | ✅ | TextAlign extension |
| Undo / Redo | ✅ | |
| Links | ✅ | LinkExtension |
| Escape → close | ✅ | |
| Image insertion | ✅ | |
| Auto-title from content | ✅ | debounce 3s |
| Tags footer input | 🔶 | Inline tags missing |
| Canvas drawings | 🔶 | Creates Sketch page, canvas UI missing |
| Autosave / durable save | 🐛✅ | Bug fixed |
| Math Resolver | ❌ | |
| Paste sanitization | ❌ | |
| AI Completion (Tab) | ❌ | |
| Feature flags editor | 🔶 | `user_settings.editor` jsonb |

---

## 4. Collab Session (Yjs + Supabase Realtime)

| Task | Status | Notes |
|------|--------|-------|
| YJS Document | ✅ | |
| IndexedDB persistence | ✅ | `y-indexeddb` |
| Supabase Realtime transport | 🐛✅ | Bug fixed: buffering until SUBSCRIBED |
| Durable save debounce | 🐛✅ | Bug fixed: dead `scheduleSave()` |
| LocalStorage backup | ✅ | |
| Hydration fallback (600ms) | ✅ | |

---

## 5. Folders

| Task | Status | Notes |
|------|--------|-------|
| Folder CRUD | ✅ | |
| Hidden folders | ✅ | |
| Manual sort / DnD | 🔶 | Field in DB, no UI |
| Folder overview grid | ❌ | |
| Context menu | 🔶 | [`BottomSheet.tsx`](src/features/app-shell/ui/components/BottomSheet.tsx) |
| Folder trash UI | 🔶 | `trashed_at` exists |

---

## 6. Search & Filters

| Task | Status | Notes |
|------|--------|-------|
| Global search | ✅ | [`search.ts`](src/shared/lib/search.ts) |
| Normalization, fuzzy | ✅ | |
| Filters popup | 🔶 | [`TopFiltersPopup.tsx`](src/features/app-shell/ui/components/TopFiltersPopup.tsx) |
| Saved filter presets | 🔶 | ui-store + UI |
| Hybrid search (vector) | ❌ | |
| Tag auto-suggestion | 🔶 | |

---

## 7. AI Engine

| Task | Status | Notes |
|------|--------|-------|
| Analyze pipeline | ✅ | |
| AI statuses | ✅ | |
| Tag generation | ✅ | |
| Batch reindex | 🔶 | |
| Embeddings / Vector search | 🔶 | Table exists, pipeline missing |
| Vision pipeline | ❌ | |
| Feedback loop | ❌ | |
| UI badges | ❌ | |

---

## 8. AI Chat Panel

| Task | Status | Notes |
|------|--------|-------|
| Slide-in panel | ✅ | [`AiChatPanel.tsx`](src/features/ai-engine/ui/AiChatPanel.tsx) |
| Header button | ✅ | |
| Response streaming | 🔶 | |
| RAG (embeddings) | ❌ | Currently `listAll()` — no vector |
| Markdown render | 🔶 | |
| Note links | 🔶 | |
| Persistent history | ❌ | |

---

## 9. Command Palette

| Task | Status | Notes |
|------|--------|-------|
| Cmd+K Palette | ✅ | [`CommandPalette.tsx`](src/features/app-shell/ui/components/CommandPalette.tsx) |
| Note / action search | ✅ | |

---

## 10. Media (BYOS)

| Task | Status | Notes |
|------|--------|-------|
| Inline images | ✅ | |
| Client-side compression | ✅ | `compress-image.ts` |
| Google Drive proxy | 🔶 | Skeleton |
| Media resize | ❌ | |

---

## 11. Lock Center

| Task | Status | Notes |
|------|--------|-------|
| Lock Center UI | ✅ | `LockContent` in BottomSheet |
| Password + SHA-256 | ✅ | [`lock-service.ts`](src/features/lock-center/lib/lock-service.ts) |
| Unlock flow sheet | ✅ | `openSheet("lock")` implemented |
| Content masking | ❌ | |

---

## 12. Export / Import

| Task | Status | Notes |
|------|--------|-------|
| Export JSON/TXT | 🔶 | |
| Import JSON bundle | 🔶 | [`note-import.ts`](src/features/notes/lib/note-import.ts) |
| Bulk export | ❌ | |
| PDF | ❌ | |

---

## 13. Theming & Settings

| Task | Status | Notes |
|------|--------|-------|
| Theme presets (data-theme) | 🔶 | CSS applied, no UI |
| CSS tokens | 🔶 | [`globals.css`](src/app/globals.css) partial |
| Background image | 🔶 | CSS vars exist, no UI |
| Opacity settings | 🔶 | CSS vars exist, no UI |
| Language RU / EN | ✅ | |
| Settings page | 🔶 | [`/app/settings`](src/app/settings/page.tsx) |
| Custom app icons | 🔶 | [`logo-mark.tsx`](src/shared/ui/logo-mark.tsx), icons replaced |

---

## 14. PWA & System

| Task | Status | Notes |
|------|--------|-------|
| PWA manifest | ✅ | |
| Service Worker | ❌ | |
| Offline shell | ❌ | |
| Reminder scheduler | ✅ | |
| ConsoleLogStore | ✅ | [`console-log-store.ts`](src/services/console-log-store.ts) |
| Feedback modal | ❌ | |

---

## 15. Offline / Sync

| Task | Status | Notes |
|------|--------|-------|
| IndexedDB offline | 🔶 | [`local-notes-repository.ts`](src/features/notes/api/local-notes-repository.ts) |
| sync_queue | ✅ | [`sync-queue.ts`](src/services/sync/sync-queue.ts) |
| Realtime | 🐛✅ | Bug fixed |
| SafeStorage fallback | ❌ | |

---

## Progress Summary

```
AUTH            ████████░░  75%
NOTES CORE      █████████░  85%
EDITOR          ████████░░  75%
COLLAB/SAVE     ████████░░  75%
FOLDERS         ███████░░░  65%
SEARCH          ██████░░░░  55%
AI ENGINE       ██████░░░░  55%
AI CHAT PANEL   █████░░░░░  50%
COMMAND PALETTE ████████░░  80%
MEDIA           ████░░░░░░  40%
LOCK CENTER     ████████░░  75%
EXPORT/IMPORT   ████░░░░░░  35%
THEMING         ████░░░░░░  40%
PWA/SYSTEM      ████░░░░░░  40%
OFFLINE/SYNC    █████░░░░░  50%
```

---

## Recommended Implementation Order

### Phase 1 — Stabilization
1. Settings page — themes, opacity, language
2. Canvas sketch UI — basic `<canvas>` for Sketch pages

### Phase 2 — Completeness
3. Embeddings pipeline → RAG in AI Chat
4. Folders DnD + grid view
5. Export UI (JSON/TXT/PDF)
6. Collaboration — sharing, invites

### Phase 3 — Growth
7. Smart Resurfacing + Daily Digest
8. Service Worker + offline shell
9. Voice-to-Note (Whisper API)
10. Note Connections / Graph View