"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { NoteCollabSessionProvider } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { selectVisibleNotes } from "@/features/notes/model/note-selectors";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { EditorErrorBoundary } from "@/shared/ui/error-boundary";
import { collabRepository } from "@/features/editor-collab/api/collab-repository";
import { useAuthStore } from "@/features/auth/model/auth-store";

import { BottomSheet } from "./components/BottomSheet";
import { EditorOverlay } from "./components/EditorOverlay";
import { Header } from "./components/Header";
import { MainSurface } from "./components/MainSurface";
import { Sidebar } from "./components/Sidebar";
import { TopFiltersPopup } from "./components/TopFiltersPopup";
import { useAppShellState } from "./hooks/use-app-shell-state";
import { useNoteInteractions } from "./hooks/use-note-interactions";
import { useReminderEffects } from "./hooks/use-reminder-effects";
import { AiChatPanel } from "@/features/ai-engine/ui/AiChatPanel";
import { CommandPalette } from "./components/CommandPalette";

export function SmartNotesShell() {

  const { data: rawFolders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const { data: settings } = useSettingsQuery();
  const user = useAuthStore((state) => state.user);
  const [invitesCount, setInvitesCount] = useState(0);

  const loadInvites = useCallback(() => {
    if (user?.email) {
      void collabRepository.fetchMyPendingInvites(user.email).then((list) => {
        setInvitesCount(list.length);
      });
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) {
      setInvitesCount(0);
      return;
    }
    loadInvites();
    const interval = setInterval(loadInvites, 30000);
    return () => clearInterval(interval);
  }, [user?.email, loadInvites]);


  const view = useUiStore((state) => state.view);
  const activeFolderId = useUiStore((state) => state.activeFolderId);
  const searchQuery = useUiStore((state) => state.searchQuery);
  const notesFilter = useUiStore((state) => state.notesFilter);
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
  const aiChatOpen = useUiStore((state) => state.aiChatOpen);
  const setView = useUiStore((state) => state.setView);
  const setActiveFolderId = useUiStore((state) => state.setActiveFolderId);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setNotesSort = useUiStore((state) => state.setNotesSort);
  const savedFilters = useUiStore((state) => state.savedFilters);
  const saveCurrentFilter = useUiStore((state) => state.saveCurrentFilter);
  const applySavedFilter = useUiStore((state) => state.applySavedFilter);
  const deleteSavedFilter = useUiStore((state) => state.deleteSavedFilter);
  const toggleFolderFilter = useUiStore((state) => state.toggleFolderFilter);
  const toggleTagFilter = useUiStore((state) => state.toggleTagFilter);
  const setUpdatedWindowDays = useUiStore((state) => state.setUpdatedWindowDays);
  const resetNotesFilter = useUiStore((state) => state.resetNotesFilter);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const setDesktopSidebarOpen = useUiStore((state) => state.setDesktopSidebarOpen);
  const toggleDesktopSidebar = useUiStore((state) => state.toggleDesktopSidebar);


  const reduceMotion = settings?.reduceMotion ?? false;
  const folderViewMode = settings?.folderViewMode ?? "full";
  const notesPerPage = settings?.notesPerPage ?? 10;
  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);


  const shellState = useAppShellState();
  const { currentNoteId, openNote, createNoteDraft, closeEditor } = useNoteInteractions({
    activeFolderId,
    setEditorOpen: shellState.setEditorOpen,
    openSheet: shellState.openSheet,
    setFiltersOpen: shellState.setFiltersOpen,
  });


  useReminderEffects(notes);


  const [tagDraft, setTagDraft] = useState("");
  const editorDirty = useNoteUiStore((state) => state.editorDirty);
  const draftNote = useNoteUiStore((state) => state.draftNote);


  const folders = useMemo(() => rawFolders.filter((folder) => !folder.trashedAt && !folder.isHidden), [rawFolders]);
  const hiddenFolders = useMemo(() => rawFolders.filter((folder) => !folder.trashedAt && folder.isHidden), [rawFolders]);
  const trashedFolders = useMemo(() => rawFolders.filter((folder) => Boolean(folder.trashedAt)), [rawFolders]);
  const activeFolder = useMemo(() => rawFolders.find((folder) => folder.id === activeFolderId) ?? null, [activeFolderId, rawFolders]);
  const tagOptions = useMemo(
    () => Array.from(new Set(notes.flatMap((note: Note) => note.userTags))).sort((left: string, right: string) => left.localeCompare(right)),
    [notes],
  );
  const currentNote = useMemo(() => {
    if (draftNote && draftNote.id === currentNoteId) return draftNote;
    return notes.find((note: Note) => note.id === currentNoteId) ?? null;
  }, [currentNoteId, notes, draftNote]);
  const visibleNotes = useMemo(
    () => selectVisibleNotes({ notes, view, activeFolderId, searchQuery, filter: notesFilter }),
    [activeFolderId, notes, notesFilter, searchQuery, view],
  );

  const filteredTagSuggestions = useMemo(() => {
    const query = tagDraft.trim().toLowerCase();

    if (!query) {
      return tagOptions.slice(0, 6);
    }

    return tagOptions.filter((tag) => tag.toLowerCase().includes(query)).slice(0, 6);
  }, [tagDraft, tagOptions]);


  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduce" : "full";

    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, [reduceMotion]);


  // Note: Global themes and opacities are applied via ThemeBridge in providers.tsx


  function toggleSidebar() {
    if (shellState.isDesktop) {
      toggleDesktopSidebar();
      return;
    }

    openMobileSidebar();
  }

  function openView(nextView: AppView) {
    setView(nextView);

    if (nextView !== "folder") {
      setActiveFolderId(null);
    }

    closeMobileSidebar();
  }

  function openFolder(folder: FolderEntity) {
    setActiveFolderId(folder.id);
    setView("folder");
    closeMobileSidebar();
  }

  const desktopSidebarVisible = shellState.isDesktop && (desktopSidebarPinned || desktopSidebarOpen);

  return (
    <main className="app-layout overflow-hidden text-foreground">
      <div className="relative flex min-h-0 flex-1 overflow-x-hidden">
        {desktopSidebarVisible ? (
          <div className="hidden lg:block">
            <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} isDesktop invitesCount={invitesCount} onClose={() => setDesktopSidebarOpen(false)} onCreateFolder={(anchor) => shellState.openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={shellState.openSheet} onSwitchView={openView} />
          </div>
        ) : null}

        <div className="main-content min-w-0 flex-1">
          <Header copy={copy} activeFolder={activeFolder} filtersOpen={shellState.filtersOpen} filtersRef={shellState.filtersRef} onOpenDrawer={toggleSidebar} onOpenFilters={() => shellState.setFiltersOpen((value) => !value)} onOpenFolderMenu={(anchor) => shellState.openSheet("folder", anchor)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} view={view} />

          {shellState.filtersOpen ? (
            <TopFiltersPopup
              folders={folders}
              notesFilter={notesFilter}
              savedFilters={savedFilters}
              tagDraft={tagDraft}
              tagSuggestions={filteredTagSuggestions}
              onResetFilters={resetNotesFilter}
              onApplySavedFilter={applySavedFilter}
              onDeleteSavedFilter={deleteSavedFilter}
              onSaveCurrentFilter={saveCurrentFilter}
              onSetNotesSort={setNotesSort}
              onSetUpdatedWindowDays={setUpdatedWindowDays}
              onToggleFolderFilter={toggleFolderFilter}
              onToggleTagFilter={toggleTagFilter}
              onTagDraftChange={setTagDraft}
              visibleSections={{
                savedFilters: settings?.interface.showSavedFilters ?? true,
                tagFilter: settings?.interface.showTagFilter ?? true,
                updatedPeriodFilter: settings?.interface.showUpdatedPeriodFilter ?? true,
              }}
            />
          ) : null}

          <MainSurface copy={copy} activeFolder={activeFolder} folderViewMode={folderViewMode} folders={folders} hiddenFolders={hiddenFolders} notes={visibleNotes} notesPerPage={notesPerPage} onOpenFolder={openFolder} onOpenNote={(id) => openNote(id, notes)} onOpenSheet={shellState.openSheet} trashedFolders={trashedFolders} view={view} onRefreshInvites={loadInvites} />
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Закрыть меню" className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={closeMobileSidebar} type="button" />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px]">
            <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} invitesCount={invitesCount} onClose={closeMobileSidebar} onCreateFolder={(anchor) => shellState.openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={shellState.openSheet} onSwitchView={openView} />
          </div>
        </div>
      ) : null}

      {/* FAB — shifts left on desktop when AI panel is open */}
      {(view === "notes" || view === "folder") && (
        <button
          className={`btn-fab fixed bottom-5 z-30 flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-accent text-accent-foreground shadow-2xl shadow-violet-950/24 transition-[right] duration-300 ${
            aiChatOpen ? "right-[440px] hidden sm:flex" : "right-5"
          }`}
          onClick={createNoteDraft}
          type="button"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Mobile FAB — always bottom-right, hidden when AI panel open on mobile */}
      {(view === "notes" || view === "folder") && (
        <button
          className={`btn-fab fixed bottom-5 right-5 z-30 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-accent text-accent-foreground shadow-2xl shadow-violet-950/24 sm:hidden ${
            aiChatOpen ? "hidden" : "flex"
          }`}
          onClick={createNoteDraft}
          type="button"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {/* AI Notes Chat Panel — Gmail-style slide-in from right ✨ */}
      <AiChatPanel onOpenNote={(id) => openNote(id, notes)} />

      {/* Command Palette — Cmd+K */}
      <CommandPalette
        onOpenNote={(id) => openNote(id, notes)}
        onCreateNote={createNoteDraft}
      />

      {shellState.editorOpen && currentNote ? (
        <EditorErrorBoundary>
          <NoteCollabSessionProvider key={currentNote.id} note={currentNote}>
            <EditorOverlay note={currentNote} onClose={closeEditor} onOpenSheet={shellState.openSheet} toolbarVisible={shellState.toolbarVisible} setToolbarVisible={shellState.setToolbarVisible} />
            <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={shellState.isDesktop} sheet={shellState.sheet} onClose={() => shellState.setSheet(null)} onOpenSheet={shellState.openSheet} />
          </NoteCollabSessionProvider>
        </EditorErrorBoundary>
      ) : null}
      {!shellState.editorOpen || !currentNote ? <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={shellState.isDesktop} sheet={shellState.sheet} onClose={() => shellState.setSheet(null)} onOpenSheet={shellState.openSheet} /> : null}
    </main>
  );
}
