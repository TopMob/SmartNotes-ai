# Implementation Plan - UI/UX Optimizations and Feature Alignments

This plan outlines the changes to resolve the UI/UX issues in `правки.md`, including login screen vertical compression, note editor formatting carousels, status indicators, guest session lifetimes, mobile search overlay, folder highlights, export Russian localizations, UTF-8 BOM encoding fixes, and auto-closing sheets.

## User Review Required

> [!IMPORTANT]
> The auto-logout timer currently embedded in `AuthProvider` will be removed. Instead, a custom `GuestSessionManager` in `SmartNotesShell` will handle both the 2-minute warning banner and the final blocking modal to allow the user a chance to register and migrate their notes rather than getting kicked out automatically.
> 
> Guest notes, folders, and settings will be migrated to the new authenticated user's LocalStorage scope upon successful sign-in/registration.

## Proposed Changes

---

### 1. Google Authentication & Chrome Support

#### [MODIFY] [google-one-tap.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/auth/lib/google-one-tap.ts)
- Pass `use_fedcm_for_prompt: true` inside `google.accounts.id.initialize`. (Note: This is already present in the source, but we will ensure it remains correct).

---

### 2. Login Screen Compression & Tab Smoothness

#### [MODIFY] [login-shell.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/auth/ui/login-shell.tsx)
- Compress margins, gaps, and sizes on mobile screens to prevent overflow and ensure the card fits comfortably on smaller viewports.
- Replace the Framer Motion `layoutId` and `AnimatePresence` on the tab background indicator with a GPU-accelerated CSS `transform` (`x`) transition to eliminate transition lag.
- Check the query parameter `mode` on mount: if `?mode=register` is present, set the active tab state to `register`.

#### [MODIFY] [auth-provider.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/auth/ui/auth-provider.tsx)
- Remove the `window.setTimeout` that automatically triggers logout on guest session expiry, allowing the workspace shell to show the blocking signup screen instead.

---

### 3. Editor Toolbar Carousel & Title Cleanups

#### [MODIFY] [EditorOverlay.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/EditorOverlay.tsx)
- Remove borders, background, outlines, and padding from the title `<input>` component so that it flows as flat, borderless text.
- Change the TipTap toolbar styles: on mobile screens, configure it as a single-row scrollable carousel (`flex-nowrap overflow-x-auto no-scrollbar scroll-smooth snap-x`), while preserving wrapping on desktop screens (`md:flex-wrap md:overflow-visible`). Add `shrink-0` to the tool groups.
- Hide status labels ("AI Анализ...", "Синхронизировано") on mobile devices in the footer, showing only semantic icons/dots with tooltips instead.
- Compress the "Done" button on mobile, rendering only the `Check` icon on small viewports and adding Russian translation "Сохранить" with icon on desktop (`sm:`).
- Render scrollable page tabs in the header using `pages.slice(0, 3)` to display titles. If `pageCount > 3`, show a `+X` button that triggers the pages bottom sheet.

#### [MODIFY] [NoteCard.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/NoteCard.tsx)
- Add the `truncate` class to the title `<h3>` tag to prevent long titles from wrapping and inflating card heights.

---

### 4. Guest Mode Alerts & Note Migration

#### [MODIFY] [SmartNotesShell.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/smart-notes-shell.tsx)
- Create a `GuestSessionManager` client component that mounts if the logged-in user is a guest.
- Display a sticky yellow banner at the top of the screen if the remaining time is less than 2 minutes.
- Show a full-page backdrop-blur blocking modal once the timer reaches zero, offering options to Register (redirects to `/login?mode=register`) or Discard ("Удалить и выйти" which clears local guest data and logs out).

#### [MODIFY] [auth-provider.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/auth/ui/auth-provider.tsx)
- In `syncSession`, check for an active guest session in local storage. If present, copy all local notes, folders, and settings to the newly authenticated user's ID keys in LocalStorage, then clear the guest session metadata.

---

### 5. Mobile Search Overlay Integration

#### [MODIFY] [Header.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/Header.tsx)
- Add a search button (magnifying glass) for mobile next to the Menu button. When tapped, dispatch a custom event `open-command-palette`.
- Hide the floating absolute search bar on mobile screens completely (`hidden md:flex`) and remove the `pb-[4rem]` spacing from the header wrapper on mobile.

#### [MODIFY] [CommandPalette.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/CommandPalette.tsx)
- Listen for the `open-command-palette` event to display the Command Palette overlay.

---

### 6. Folder Selection Highlighting & Menus

#### [MODIFY] [BottomSheet.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/BottomSheet.tsx)
- Add an `active` prop to the `ActionCard` utility.
- Highlight the currently active folder inside the "Move to Folder" popup list.
- Add Lucide icons and dividing lines inside `FolderActionList` to segment options into categories (Rename/Description, Order, Share, Delete).
- Translate export button texts inside the export dropdown to Russian when the app language is `"ru"`.
- Replace the "Удалить" text button in `PagesContent` list with a trash icon (`Trash2`).
- Update `NoteActionSheet`'s "Remind" button to open the reminder sheet (`onOpenSheet("reminder", null)`) instead of setting a hardcoded 24h reminder.
- Close the parent bottom sheet when a note is moved to a folder, or when a folder is trashed (pass `onClose` to `FolderActionList`).
- Update `LockModal` to call `onClose(true)` on password success, and close the parent bottom sheet in `BottomSheet.tsx` if `success` is true.

#### [MODIFY] [lock-modal.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/lock-center/ui/lock-modal.tsx)
- Accept a `success` parameter in `onClose` callback and trigger it on successful lock setting/removal.

---

### 7. Export Encoding & Import Sanitization

#### [MODIFY] [shared.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/shared.ts)
- Modify `downloadTextFile` to prefix text content with the `\uFEFF` Byte Order Mark (BOM) to prevent corrupt characters ("кракозябры") in Russian text on Windows Notepad/Excel.

#### [MODIFY] [note-import.ts](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/notes/lib/note-import.ts)
- Strip out any leading `\uFEFF` character from text content in `parseImportedNoteFile` and `parseImportedNotesFile` before parsing as JSON.

---

## Verification Plan

### Automated Tests
- Run `npm run build` and `npm run typecheck` to verify that there are no syntax, typing, or compilation errors.

### Manual Verification
- **Login screen**: Open login on mobile viewport. Verify that the form fits inside the viewport and scrolls if needed, and tabs transition immediately.
- **Mobile Search**: Open on mobile view. Verify that the overlapping search bar is gone. Tap the search icon; verify that the Command Palette overlay opens focused.
- **Reminders & Locks**: Verify that clicking the remind button opens the date/time selector sheet. Verify that setting a password closes both the lock modal and the action sheet.
- **Exporting**: Export a note containing Russian text to `.txt`. Open it in Notepad; verify Russian text reads correctly.
