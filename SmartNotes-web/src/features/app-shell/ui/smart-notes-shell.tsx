"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { NoteCollabSessionProvider } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteDetails, useNotesFlat, useInvitesQuery } from "@/features/notes/hooks/use-notes-query";
import { selectVisibleNotes } from "@/features/notes/model/note-selectors";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { EditorErrorBoundary } from "@/shared/ui/error-boundary";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { isGuestUser, readGuestSessionWithoutCleanup } from "@/features/auth/lib/guest-session";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { Button } from "@/shared/ui/button";

import { Header } from "./components/Header";
import { MainSurface } from "./components/MainSurface";
import { Sidebar } from "./components/Sidebar";
import { useAppShellState } from "./hooks/use-app-shell-state";
import { useNoteInteractions } from "./hooks/use-note-interactions";
import { useReminderEffects } from "./hooks/use-reminder-effects";
import { BottomSheet } from "./components/BottomSheet";
import dynamic from "next/dynamic";
const EditorOverlay = dynamic(() => import("./components/EditorOverlay").then(mod => mod.EditorOverlay), { ssr: false });
import { TopFiltersPopup } from "./components/TopFiltersPopup";
import { AiChatPanel } from "@/features/ai-engine/ui/AiChatPanel";
import { CommandPalette } from "./components/CommandPalette";
import { LockManager } from "@/features/lock-center/ui/lock-manager";

export function SmartNotesShell() {

  const { data: rawFolders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const { data: settings } = useSettingsQuery();
  const user = useAuthStore((state) => state.user);
  const { data: invites = [] } = useInvitesQuery();
  const invitesCount = invites.length;


  const view = useUiStore((state) => state.view);
  const activeFolderId = useUiStore((state) => state.activeFolderId);
  const searchQuery = useUiStore((state) => state.searchQuery);
  const semanticSearchQuery = useUiStore((state) => state.semanticSearchQuery);
  const notesFilter = useUiStore((state) => state.notesFilter);
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
  const aiChatOpen = useUiStore((state) => state.aiChatOpen);
  const toggleAiChat = useUiStore((state) => state.toggleAiChat);
  const setView = useUiStore((state) => state.setView);
  const setActiveFolderId = useUiStore((state) => state.setActiveFolderId);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setSemanticSearchQuery = useUiStore((state) => state.setSemanticSearchQuery);
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
  const folderViewMode = "full";
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
  const [semanticNoteIds, setSemanticNoteIds] = useState<string[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const editorDirty = useNoteUiStore((state) => state.editorDirty);
  const draftNote = useNoteUiStore((state) => state.draftNote);
  const noteDetailsQuery = useNoteDetails(draftNote ? null : currentNoteId);


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
    return noteDetailsQuery.data ?? null;
  }, [currentNoteId, draftNote, noteDetailsQuery.data]);
  const visibleNotes = useMemo(
    () => selectVisibleNotes({ notes, view, activeFolderId, searchQuery, filter: notesFilter }),
    [activeFolderId, notes, notesFilter, searchQuery, view],
  );
  const semanticCandidates = useMemo(
    () => selectVisibleNotes({ notes, view, activeFolderId, searchQuery: "", filter: notesFilter }),
    [activeFolderId, notes, notesFilter, view],
  );
  const semanticNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const lexicalIds = new Set(visibleNotes.map((note) => note.id));
    const noteMap = new Map(semanticCandidates.map((note) => [note.id, note]));

    return semanticNoteIds
      .filter((noteId) => !lexicalIds.has(noteId))
      .map((noteId) => noteMap.get(noteId))
      .filter((note): note is Note => Boolean(note));
  }, [searchQuery, semanticCandidates, semanticNoteIds, visibleNotes]);

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

  useEffect(() => {
    const query = semanticSearchQuery.trim();

    if (!query) {
      if (semanticNoteIds.length > 0) {
        setSemanticNoteIds([]);
      }
      if (semanticLoading) {
        setSemanticLoading(false);
      }
      return;
    }

    const candidateNotes = semanticCandidates;

    if (!candidateNotes.length) {
      if (semanticNoteIds.length > 0) {
        setSemanticNoteIds([]);
      }
      if (semanticLoading) {
        setSemanticLoading(false);
      }
      return;
    }

    const controller = new AbortController();
    if (!semanticLoading) {
      setSemanticLoading(true);
    }

    void fetch("/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        candidateNoteIds: candidateNotes.map((note) => note.id),
        notes: user ? undefined : candidateNotes,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Semantic search failed: ${response.status}`);
        }

        return response.json() as Promise<{ matches?: Array<{ noteId: string; similarity: number }> }>;
      })
      .then((payload) => {
        const nextIds = (payload.matches ?? []).map((match) => match.noteId);
        const changed = nextIds.length !== semanticNoteIds.length || nextIds.some((id, i) => id !== semanticNoteIds[i]);
        if (changed) {
          setSemanticNoteIds(nextIds);
        }
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return;
        }

        console.error(error);
        if (semanticNoteIds.length > 0) {
          setSemanticNoteIds([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSemanticLoading(false);
        }
      });

    return () => controller.abort();
  }, [semanticCandidates, semanticSearchQuery, user, semanticNoteIds, semanticLoading]);


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

  const handleCloseSheet = useCallback(() => {
    if (shellState.sheet?.name === "lock") {
      useNoteUiStore.getState().setCurrentNoteId(null);
    }
    shellState.setSheet(null);
  }, [shellState]);

  const desktopSidebarVisible = shellState.isDesktop && (desktopSidebarPinned || desktopSidebarOpen);

  return (
    <main className="app-layout overflow-hidden text-foreground">
      <div className="relative flex min-h-0 flex-1 overflow-x-hidden">
        {desktopSidebarVisible ? (
          <div className="hidden lg:block h-full">
            <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} isDesktop invitesCount={invitesCount} onClose={() => setDesktopSidebarOpen(false)} onCreateFolder={(anchor) => shellState.openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={shellState.openSheet} onSwitchView={openView} />
          </div>
        ) : null}

        <div className={`main-content min-w-0 flex-1 transition-[padding] duration-300 ${aiChatOpen ? "lg:pr-[420px]" : ""}`}>
          <Header copy={copy} activeFolder={activeFolder} filtersOpen={shellState.filtersOpen} filtersRef={shellState.filtersRef} onOpenDrawer={toggleSidebar} onOpenFilters={() => shellState.setFiltersOpen((value) => !value)} onOpenFolderMenu={(anchor) => shellState.openSheet("folder", anchor)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSemanticSearchQuery={setSemanticSearchQuery} view={view} aiChatOpen={aiChatOpen} onToggleAiChat={toggleAiChat} />

          {shellState.filtersOpen ? (
            <TopFiltersPopup
              popupRef={shellState.filtersPopupRef}
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

          <MainSurface copy={copy} activeFolder={activeFolder} folderViewMode={folderViewMode} folders={folders} hiddenFolders={hiddenFolders} notes={visibleNotes} semanticNotes={semanticNotes} semanticLoading={semanticLoading} notesPerPage={notesPerPage} onOpenFolder={openFolder} onOpenNote={(id) => openNote(id, notes)} onOpenSheet={shellState.openSheet} trashedFolders={trashedFolders} view={view} />
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

      {/* FAB - shifts left on desktop when AI panel is open */}
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

      {/* Mobile FAB - always bottom-right, hidden when AI panel open on mobile */}
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

      {/* AI Notes Chat Panel - Gmail-style slide-in from right ✨ */}
      <AiChatPanel onOpenNote={(id) => openNote(id, notes)} activeNote={currentNote} />

      {/* Command Palette - Cmd+K */}
      <CommandPalette
        onOpenNote={(id) => openNote(id, notes)}
        onCreateNote={createNoteDraft}
      />

      {shellState.editorOpen && currentNote ? (
        <EditorErrorBoundary>
          <NoteCollabSessionProvider key={currentNote.id} note={currentNote}>
            <EditorOverlay note={currentNote} onClose={closeEditor} onOpenSheet={shellState.openSheet} toolbarVisible={shellState.toolbarVisible} setToolbarVisible={shellState.setToolbarVisible} />
            <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={shellState.isDesktop} sheet={shellState.sheet} onClose={handleCloseSheet} onCloseWithoutClear={() => shellState.setSheet(null)} onOpenSheet={shellState.openSheet} onOpenEditor={() => shellState.setEditorOpen(true)} onCloseEditor={closeEditor} />
          </NoteCollabSessionProvider>
        </EditorErrorBoundary>
      ) : null}
      {!shellState.editorOpen || !currentNote ? <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={shellState.isDesktop} sheet={shellState.sheet} onClose={handleCloseSheet} onCloseWithoutClear={() => shellState.setSheet(null)} onOpenSheet={shellState.openSheet} onOpenEditor={() => shellState.setEditorOpen(true)} onCloseEditor={closeEditor} /> : null}
      
      <LockManager />
      <GuestSessionManager />
    </main>
  );
}

function GuestSessionManager() {
  const user = useAuthStore((state) => state.user);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { logout } = useAuthActions();

  useEffect(() => {
    if (!isGuestUser(user)) return;

    // Check immediately
    const session = readGuestSessionWithoutCleanup();
    if (!session) {
      setTimeLeft(0);
    } else {
      setTimeLeft(Math.max(0, session.expiresAt - Date.now()));
    }

    const interval = setInterval(() => {
      const session = readGuestSessionWithoutCleanup();
      if (!session) {
        setTimeLeft(0);
        return;
      }
      const remaining = Math.max(0, session.expiresAt - Date.now());
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  if (!isGuestUser(user) || timeLeft === null) return null;

  const showBanner = timeLeft > 0 && timeLeft <= 120000; // 2 minutes
  const showBlockingModal = timeLeft <= 0;

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const handleRegister = () => {
    window.location.assign("/login?mode=register");
  };

  const handleDiscard = async () => {
    await logout();
  };

  return (
    <>
      {showBanner && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2.5 text-center text-xs font-black shadow-lg flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <span>⚠️ Гостевой режим завершится через {formattedTime}. Сохраните прогресс!</span>
          <button 
            onClick={handleRegister} 
            className="rounded-lg bg-amber-950 text-amber-500 px-3 py-1 text-[10px] font-black uppercase hover:bg-amber-900 transition"
          >
            Зарегистрироваться
          </button>
        </div>
      )}

      {showBlockingModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[2.2rem] border border-border bg-surface-strong p-6 shadow-2xl text-center">
            <span className="text-3xl">⏳</span>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground">Время гостевой сессии истекло!</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/64 font-medium">
              Чтобы ваши заметки не удалились локально, зарегистрируйтесь прямо сейчас. Мы автоматически перенесем все созданные записи в ваш новый личный аккаунт.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button 
                onClick={handleRegister} 
                className="w-full rounded-xl h-12 transition-all font-black text-sm"
              >
                Сохранить заметки и Зарегистрироваться
              </Button>
              <button 
                onClick={handleDiscard} 
                className="w-full rounded-xl h-11 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                Удалить и выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
