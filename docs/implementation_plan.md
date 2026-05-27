# Technical Audit & Optimization Plan: Preparing SmartNotes AI for Defense

This document contains a comprehensive technical audit of the SmartNotes AI application. It details unimplemented/partially implemented features, identifies unnecessary technical labels/screens in the UI, details system-wide optimizations (mobile, offline, cross-browser), and lists type/linter cleanups needed to ensure `npm run lint` and `npm run build` pass without warnings.

---

## 1. Feature Status Audit

The following table summarizes the actual status of features in the codebase compared to user expectations for a finished product:

| Feature Area | Sub-Feature | Actual Status | Technical Description & Missing Parts |
|:---|:---|:---|:---|
| **Auth & Profile** | Display Name & Avatar Change | ✅ **Done** | Fully localized sidebar/header profiles, settings form labels, and profile modals using the locale-aware `uiCopy` translation system. |
| | Google OAuth / One Tap | ✅ **Done** | Implemented in `login-shell.tsx`. |
| | Guest Cooldown / Copy UID | ✅ **Done** | Added 5-minute Google One Tap prompt cooldown on dismissal/skip; Copy profile UID uses localized state-based "Copied!" toast confirmation. |
| **Notes Core** | Page Management | ✅ **Done** | Page deletion and addition prompts/alerts are fully localized using dynamic `uiCopy` dictionary. |
| | Auto-title | ✅ **Done** | Triggers correctly on debounced note saving. |
| | Scroll Position Memory | ✅ **Done** | Editor automatically saves and restores the scroll container's scrollTop value in localStorage, keyed by Note ID and page index. |
| **Editor & Canvas** | Rich Text | ✅ **Done** | Tiptap toolbar formats bold, italic, underline, alignment. |
| | Canvas Drawing | ✅ **Done** | Drawing canvas supports high-DPI scaling, pen, eraser, brush size, custom color picker, undo/redo. |
| | Math Resolver | ❌ **Removed** | Math calculator extension and mathjs dependency have been deleted completely from the codebase per user instruction. |
| | Paste Sanitizer | ✅ **Done** | Paste handler strips scripts, iframes, and inline event handlers (`on*`) using a standard browser `DOMParser` sanitizer to prevent XSS. |
| | Tag Suggestion Input | ✅ **Done** | Input bar displays a floating suggestion dropdown autocomplete matching existing user tags dynamically. |
| **Collab & Sync** | Supabase Realtime + Yjs | ✅ **Done** | Realtime broadcast channel synchronization and local IndexedDB cache sync are working. |
| | Offline Queue | ✅ **Done** | Outgoing mutations are buffered in `sync_queue` and resolved. |
| **Folders** | Drag & Drop | ✅ **Done** | Sidebar local folders list query is sorted by the manual reorder field `folderOrder`. |
| | Trash UI | ✅ **Done** | Folder deletion confirmations are fully localized and dynamically translated. |
| **Search & Filters** | Global Search | ✅ **Done** | Fuzzy search, layout correction, and field weighting are implemented. |
| | Vector Search / RAG | ✅ **Done** | Embeddings are calculated and stored in DB for registered users. For guest/local users, the app transmits local notes to the server dynamically to run vector matching on the fly, enabling full RAG capabilities. |
| **BYOS Media** | Upload Proxy | ✅ **Done** | Google Drive oauth scope (`drive.file`) is requested during Google OAuth sign-in to ensure the proxy has access to save user images directly to Google Drive. |
| **Lock Center** | Zero-knowledge Lock | ✅ **Done** | Encrypted/locked note cards mask tags list as well as note body preview on dashboard view to prevent leakage. |
| **System & PWA** | Service Worker | ✅ **Done** | Implemented custom offline Service Worker caching with stale-while-revalidate strategy in `public/sw.js`. |

---

## 2. Technical Labels & UI Polish (Defense Ready)

To prepare the application for presentation to end-users (and defense), all technical labels and developer diagnostic views must be cleaned up or hidden:

### A. Hide "Admin Tools" behind Developer Mode
- **Problem**: The sidebar displays an "Admin Tools" link (`Shield` icon) that opens a dashboard showing collab status, active sockets, sync backlog, and database logs. This looks highly technical and unpolished to end users.
- **Proposed Solution**: We will hide the Admin Tools menu by default. We will implement an elegant **Developer Mode** toggle: clicking the `LogoMark` in the sidebar 7 times will toggle Developer Mode (saved in Zustand / LocalStorage). A subtle toast/notification will alert the developer that they have entered Developer Mode, which then exposes the Admin Tools menu.

### B. Localize Hardcoded Russian Prompts
- **Problem**: Prompts and alerts in `BottomSheet.tsx`, `Header.tsx`, and `EditorOverlay.tsx` contain hardcoded Russian text (e.g., `"Контент заметки скрыт до локальной verify-проверки. Preview уже замаскирован в карточке."`, `"Удалить текущую страницу?"`, `"Новое имя папки"`, `"Сменить аватар"`). This breaks the Russian/English language switcher since they are not translated when switching to English.
- **Proposed Solution**: Move all these hardcoded Russian strings into the `uiCopy` dictionary in [i18n.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/shared/lib/i18n.ts) and reference them dynamically through the `copy` object.

### C. Clean up AI Engine Status Badges
- **Problem**: The note editor footer contains raw developer labels: `AI: pending`, `durableState: isSaving`, `editorDirty: true`.
- **Proposed Solution**: Replace these labels with polished, visually elegant micro-animations/badges (e.g., a spinning AI icon, a pulsing save indicator).

---

## 3. Device & Browser Optimization

To ensure seamless performance during the defense across all devices:

### A. Mobile Keyboard Adjustments
- Ensure the absolute search bar in `Header.tsx` on mobile doesn't overlap text inputs or cause layout shifts.
- Prevent the mobile FAB (Plus button) from overlapping editor controls.

### B. High-DPI Canvas Resizing
- The `DrawingCanvas.tsx` properly implements high-DPI scaling (`window.devicePixelRatio`). We will double check that touch gestures do not trigger unwanted window scrolling by ensuring `touch-action: none` is set correctly.

---

## 4. Lint and Type Cleanups

We will fix all 14 errors and 7 warnings identified in the ESLint check to ensure the project passes tests:
1. **Remove `any` types**: Replace `any` casts in `analyze/route.ts`, `chat/route.ts`, `settings/page.tsx`, `use-auto-analyze.ts`, `settings-mappers.ts`, and `local-embeddings.ts` with strict TypeScript types or type-safe assertions (`unknown`, `Record`).
2. **Remove Unused Imports**: Delete the unused `Loader2` import in `AiChatPanel.tsx`.
3. **Fix useEffect Dependency Arrays**: Add missing dependencies in `EditorOverlay.tsx` and `use-note-collab-session.tsx`.
4. **Fix Unused Variables**: Clean up unused variables in `ai-queue.ts`.

---

## Proposed Changes

### [app-shell]

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/Sidebar.tsx)
- Hide the "Admin Tools" button unless `developerMode` is active.
- Bind the sidebar `LogoMark` button to track clicks and toggle `developerMode` when clicked 7 times.

#### [MODIFY] [BottomSheet.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/BottomSheet.tsx)
- Clean up all hardcoded Russian text prompts and alerts, using the `copy` dictionary instead.
- Localize "Unlock" button in Lock Center panel.

#### [MODIFY] [Header.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/Header.tsx)
- Localize hardcoded prompts in user profile menu.

### [settings]

#### [MODIFY] [page.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/app/settings/page.tsx)
- Fix type assertions to remove `any` eslint errors in provider checks.

### [ai-engine]

#### [MODIFY] [route.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/app/api/ai/analyze/route.ts)
- Fix catch error typing and dbMetadata typing from `any` to strict types.

#### [MODIFY] [route.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/app/api/ai/chat/route.ts)
- Fix RPC matching response array from `any[]` to strict `EmbeddingMatch[]` type.

#### [MODIFY] [use-auto-analyze.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/ai-engine/hooks/use-auto-analyze.ts)
- Fix metadata type assertion from `any` to strict type.

#### [MODIFY] [AiChatPanel.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/ai-engine/ui/AiChatPanel.tsx)
- Remove unused `Loader2` import.

### [shared]

#### [MODIFY] [i18n.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/shared/lib/i18n.ts)
- Add missing translations for dialog alerts, folder deletion confirmations, page deletion, profile updates, and locking/unlocking.

---

## Verification Plan

### Automated Tests
- Run `npm run typecheck` to confirm TypeScript builds successfully.
- Run `npm run lint` to verify that all ESLint warnings and errors are fully resolved.
- Run `npm run build` to verify production builds compile cleanly.

### Manual Verification
- Test clicking the Sidebar logo 7 times to check if developer tools are unlocked and toggle correctly.
- Test the language switcher (RU/EN) in Settings and verify all sheets (Rename page, rename folder, lock center alerts, etc.) update their text correctly.
