"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { addNote } from "@/features/notes/model/note-actions";
import { selectVisibleNotes } from "@/features/notes/model/note-selectors";
import { useFoldersStore } from "@/features/folders/model/folders-store";
import { useNotesStore } from "@/features/notes/model/notes-store";
import { requestNotificationPermission, showNotification } from "@/services/notifications/notification-service";
import { scheduleReminder } from "@/services/reminders/reminder-service";
import { subscribe } from "@/services/event-bus";
import { getUiCopy } from "@/shared/lib/i18n";
import { useThemeStore } from "@/shared/store/theme-store";
import { type AppView, useUiStore } from "@/shared/store/ui-store";

import { BottomSheet } from "./components/BottomSheet";
import { EditorOverlay } from "./components/EditorOverlay";
import { Header } from "./components/Header";
import { MainSurface } from "./components/MainSurface";
import { Sidebar } from "./components/Sidebar";
import { TopFiltersPopup } from "./components/TopFiltersPopup";
import type { SheetAnchor, SheetName, SheetState } from "./components/shared";

export function SmartNotesShell() {
  const rawFolders = useFoldersStore((state) => state.folders);
  const notes = useNotesStore((state) => state.notes);
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const editorDirty = useNotesStore((state) => state.editorDirty);
  const setCurrentNoteId = useNotesStore((state) => state.setCurrentNoteId);
  const setCurrentNotePageIndex = useNotesStore((state) => state.setCurrentNotePageIndex);
  const view = useUiStore((state) => state.view);
  const activeFolderId = useUiStore((state) => state.activeFolderId);
  const searchQuery = useUiStore((state) => state.searchQuery);
  const notesFilter = useUiStore((state) => state.notesFilter);
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
  const reduceMotion = useThemeStore((state) => state.reduceMotion);
  const folderViewMode = useThemeStore((state) => state.folderViewMode);
  const notesPerPage = useThemeStore((state) => state.notesPerPage);
  const lang = useThemeStore((state) => state.lang);
  const authUser = useAuthStore((state) => state.user);
  const copy = getUiCopy(lang);
  const setView = useUiStore((state) => state.setView);
  const setActiveFolderId = useUiStore((state) => state.setActiveFolderId);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setNotesSort = useUiStore((state) => state.setNotesSort);
  const toggleFolderFilter = useUiStore((state) => state.toggleFolderFilter);
  const toggleTagFilter = useUiStore((state) => state.toggleTagFilter);
  const setUpdatedWindowDays = useUiStore((state) => state.setUpdatedWindowDays);
  const resetNotesFilter = useUiStore((state) => state.resetNotesFilter);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const setDesktopSidebarOpen = useUiStore((state) => state.setDesktopSidebarOpen);
  const toggleDesktopSidebar = useUiStore((state) => state.toggleDesktopSidebar);

  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const profileRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  const folders = useMemo(() => rawFolders.filter((folder) => !folder.trashedAt && !folder.isHidden), [rawFolders]);
  const hiddenFolders = useMemo(() => rawFolders.filter((folder) => !folder.trashedAt && folder.isHidden), [rawFolders]);
  const trashedFolders = useMemo(() => rawFolders.filter((folder) => Boolean(folder.trashedAt)), [rawFolders]);
  const activeFolder = useMemo(() => rawFolders.find((folder) => folder.id === activeFolderId) ?? null, [activeFolderId, rawFolders]);
  const tagOptions = useMemo(
    () => Array.from(new Set(notes.flatMap((note) => note.userTags))).sort((left, right) => left.localeCompare(right)),
    [notes],
  );
  const currentNote = useMemo(() => notes.find((note) => note.id === currentNoteId) ?? null, [currentNoteId, notes]);
  const visibleNotes = useMemo(
    () => selectVisibleNotes({ notes, view, activeFolderId, searchQuery, filter: notesFilter }),
    [activeFolderId, notes, notesFilter, searchQuery, view],
  );

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduce" : "full";

    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, [reduceMotion]);

  useEffect(() => {
    const unsubscribe = subscribe("reminderTriggered", async ({ noteId }) => {
      const triggeredNote = useNotesStore.getState().notes.find((item) => item.id === noteId);

      if (!triggeredNote) {
        return;
      }

      const permission = await requestNotificationPermission();

      if (permission === "granted") {
        showNotification(triggeredNote.title || "Reminder", {
          body: triggeredNote.content.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 120),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    notes.forEach((note) => scheduleReminder(note.id, note.reminderAt));
  }, [notes]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }

      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    function syncViewport() {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);

      if (desktop && !desktopSidebarOpen) {
        setDesktopSidebarOpen(true);
      }

      if (!desktop) {
        setDesktopSidebarOpen(false);
      }

      if (desktopSidebarPinned && desktop) {
        setDesktopSidebarOpen(true);
      }
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => window.removeEventListener("resize", syncViewport);
  }, [desktopSidebarOpen, desktopSidebarPinned, setDesktopSidebarOpen]);

  function toggleSidebar() {
    if (isDesktop) {
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

  function openNote(noteId: string) {
    const note = notes.find((item) => item.id === noteId);

    if (!note) {
      return;
    }

    setCurrentNoteId(noteId);
    setCurrentNotePageIndex(0);

    setFiltersOpen(false);

    if (note.lock?.hidden) {
      openSheet("lock");
      return;
    }

    setEditorOpen(true);
  }

  function createNoteDraft() {
    const note = addNote({ title: "", content: "", folderId: activeFolderId, userTags: [] }, authUser?.id ?? "local-user");
    setCurrentNoteId(note.id);
    setEditorOpen(true);
  }

  function openSheet(name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) {
    setSheet({ name, anchor: anchor ?? null });
  }

  const filteredTagSuggestions = useMemo(() => {
    const query = tagDraft.trim().toLowerCase();

    if (!query) {
      return tagOptions.slice(0, 6);
    }

    return tagOptions.filter((tag) => tag.toLowerCase().includes(query)).slice(0, 6);
  }, [tagDraft, tagOptions]);

  function closeEditor() {
    setEditorOpen(false);
    setCurrentNoteId(null);
    setCurrentNotePageIndex(0);
  }

  const desktopSidebarVisible = isDesktop && (desktopSidebarPinned || desktopSidebarOpen);

  return (
    <main className="app-layout overflow-hidden text-foreground">
      <div className="relative flex min-h-0 flex-1 overflow-x-hidden">
        {desktopSidebarVisible ? (
          <div className="hidden lg:block">
            <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} isDesktop onClose={() => setDesktopSidebarOpen(false)} onCreateFolder={(anchor) => openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={openSheet} onSwitchView={openView} />
          </div>
        ) : null}

        <div className="main-content min-w-0 flex-1">
          <Header copy={copy} activeFolder={activeFolder} filtersOpen={filtersOpen} filtersRef={filtersRef} onOpenDrawer={toggleSidebar} onOpenFilters={() => setFiltersOpen((value) => !value)} onOpenFolderMenu={(anchor) => openSheet("folder", anchor)} profileOpen={profileOpen} profileRef={profileRef} searchQuery={searchQuery} setProfileOpen={setProfileOpen} setSearchQuery={setSearchQuery} view={view} />

          {filtersOpen ? (
            <TopFiltersPopup
              folders={folders}
              notesFilter={notesFilter}
              tagDraft={tagDraft}
              tagSuggestions={filteredTagSuggestions}
              onResetFilters={resetNotesFilter}
              onSetNotesSort={setNotesSort}
              onSetUpdatedWindowDays={setUpdatedWindowDays}
              onToggleFolderFilter={toggleFolderFilter}
              onToggleTagFilter={toggleTagFilter}
              onTagDraftChange={setTagDraft}
            />
          ) : null}

          <MainSurface copy={copy} activeFolder={activeFolder} folderViewMode={folderViewMode} folders={folders} hiddenFolders={hiddenFolders} notes={visibleNotes} notesPerPage={notesPerPage} onOpenFolder={openFolder} onOpenNote={openNote} onOpenSheet={openSheet} trashedFolders={trashedFolders} view={view} />
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Закрыть меню" className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={closeMobileSidebar} type="button" />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px]">
            <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} onClose={closeMobileSidebar} onCreateFolder={(anchor) => openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={openSheet} onSwitchView={openView} />
          </div>
        </div>
      ) : null}

      <button className="btn-fab fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center bg-accent text-accent-foreground shadow-2xl shadow-violet-950/24" onClick={createNoteDraft} type="button">
        <Plus className="h-6 w-6" />
      </button>

      {editorOpen && currentNote ? <EditorOverlay note={currentNote} onClose={closeEditor} onOpenSheet={openSheet} toolbarVisible={toolbarVisible} setToolbarVisible={setToolbarVisible} /> : null}
      <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={isDesktop} sheet={sheet} onClose={() => setSheet(null)} />
    </main>
  );
}
