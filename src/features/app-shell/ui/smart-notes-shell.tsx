"use client";

import {
  Archive,
  Bell,
  Brain,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileImage,
  EyeOff,
  Folder,
  Heart,
  Inbox,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  List,
  RotateCcw,
  Save,
  Search,
  Share2,
  Shield,
  Italic,
  Paintbrush,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Underline,
  Strikethrough,
  Trash2,
  Undo2,
  UserRound,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { addFolder, hideFolder, permanentlyDeleteFolder, renameFolder, restoreFolder, trashFolder, unhideFolder } from "@/features/folders/model/folder-actions";
import { useFoldersStore } from "@/features/folders/model/folders-store";
import { createNoteLock, maskLockedPreview, verifyNoteLock } from "@/features/lock-center/lib/lock-service";
import { addNote, addPage, attachMedia, deletePage, moveNoteToFolder, patchNote, permanentlyDeleteNote, restoreNote, setArchived, setReminder, toggleFavorite, togglePinned, trashNote, updatePage } from "@/features/notes/model/note-actions";
import { type NotesSort, selectPinnedGroups, selectVisibleNotes } from "@/features/notes/model/note-selectors";
import { useNotesStore } from "@/features/notes/model/notes-store";
import { requestNotificationPermission, showNotification } from "@/services/notifications/notification-service";
import { scheduleReminder } from "@/services/reminders/reminder-service";
import { subscribe } from "@/services/event-bus";
import { listPendingAiAnalysis } from "@/services/ai/ai-queue";
import { listSyncQueue } from "@/services/sync/sync-queue";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { useThemeStore } from "@/shared/store/theme-store";
import { Button } from "@/shared/ui/button";

type SheetName = "folder" | "note" | "pages" | "lock" | "about" | "create-folder" | "reminder" | null;
type SheetAnchor = { x: number; y: number; placement: "above" | "below" };
type SheetState = { name: Exclude<SheetName, null>; anchor: SheetAnchor | null } | null;

type ShellNavKey = "notes" | "favorites" | "archive" | "reminders" | "locked" | "trash" | "folders" | "hiddenFolders" | "adminTools";

const navItems: Array<{ key: ShellNavKey; view: AppView; icon: typeof Inbox }> = [
  { key: "notes", view: "notes", icon: Inbox },
  { key: "favorites", view: "favorites", icon: Heart },
  { key: "archive", view: "archive", icon: Archive },
  { key: "reminders", view: "reminders", icon: Bell },
  { key: "locked", view: "locked", icon: Lock },
  { key: "trash", view: "trash", icon: Trash2 },
  { key: "folders", view: "folders", icon: Folder },
  { key: "hiddenFolders", view: "hidden_folders", icon: EyeOff },
  { key: "adminTools", view: "admin_tools", icon: Shield },
];

const sortOptions: Array<{ label: string; value: NotesSort }> = [
  { label: "По времени", value: "updated" },
  { label: "AI relevance", value: "ai_relevance" },
  { label: "Важность", value: "importance" },
  { label: "Алфавит", value: "alphabet" },
];

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/gu, " ").replace(/&nbsp;/gu, " ").replace(/\s+/gu, " ").trim();
}

function getLockPassword(promptText: string) {
  const value = window.prompt(promptText);

  if (value === null) {
    return null;
  }

  const password = value.trim();

  if (!password) {
    window.alert("Пароль не может быть пустым.");
    return null;
  }

  return password;
}

async function toggleNoteLock(noteId: string) {
  const note = useNotesStore.getState().notes.find((item) => item.id === noteId);

  if (!note) {
    return false;
  }

  if (note.lock) {
    const password = getLockPassword("Введите пароль для снятия блокировки");

    if (!password) {
      return false;
    }

    const valid = await verifyNoteLock(note.lock, password);

    if (!valid) {
      window.alert("Неверный пароль.");
      return false;
    }

    patchNote(noteId, { lock: null }, { scheduleAnalysis: false });
    return true;
  }

  const password = getLockPassword("Задайте пароль для заметки");

  if (!password) {
    return false;
  }

  const confirmPassword = getLockPassword("Повторите пароль для подтверждения");

  if (!confirmPassword) {
    return false;
  }

  if (password !== confirmPassword) {
    window.alert("Пароли не совпадают.");
    return false;
  }

  const lock = await createNoteLock(password);
  patchNote(noteId, { lock }, { scheduleAnalysis: false });
  return true;
}

function getSheetAnchor(rect: DOMRect): SheetAnchor {
  const spaceBelow = window.innerHeight - rect.bottom;
  const placement = spaceBelow < 360 && rect.top > 360 ? "above" : "below";

  return {
    x: rect.left + rect.width / 2,
    y: placement === "below" ? rect.bottom + 12 : rect.top - 12,
    placement,
  };
}

function getNotePlainText(note: Note) {
  return stripHtml([
    note.title,
    ...note.pages.map((page) => `${page.title}\n${stripHtml(page.content)}`),
  ].filter(Boolean).join("\n\n"));
}

async function copyNoteText(note: Note) {
  const text = getNotePlainText(note);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportNoteAsTxt(note: Note) {
  downloadTextFile(`${note.title || "note"}.txt`, getNotePlainText(note));
}

function exportNoteForImport(note: Note) {
  downloadTextFile(
    `${note.title || "note"}.json`,
    JSON.stringify(note, null, 2),
    "application/json;charset=utf-8",
  );
}

function exportNoteAsPdf(note: Note) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(note.title || "Note")}</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:900px;margin:0 auto;color:#111}.meta{color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.12em}.page{margin-top:24px;padding-top:18px;border-top:1px solid #ddd}.content{white-space:pre-wrap;line-height:1.6}</style></head><body><div class="meta">SmartNotes</div><h1>${escapeHtml(note.title || "Без названия")}</h1><div class="content">${escapeHtml(getNotePlainText(note)).replace(/\n/g, "<br>")}</div></body></html>`;
  const preview = window.open("", "_blank", "noopener,noreferrer");

  if (!preview) {
    return;
  }

  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  preview.focus();
  preview.print();
}

function plainTextToEditorContent(value: string) {
  if (!value.trim()) {
    return "<p></p>";
  }

  if (value.includes("<") && value.includes(">")) {
    return value;
  }

  return value
    .split(/\n+/u)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function serializeEditorSnapshot(note: Note) {
  return JSON.stringify({
    title: note.title,
    folderId: note.folderId,
    userTags: note.userTags,
    content: note.content,
    pages: note.pages.map((page) => ({ id: page.id, title: page.title, content: page.content, drawingRevision: page.drawingRevision })),
  });
}

export function SmartNotesShell() {
  const rawFolders = useFoldersStore((state) => state.folders);
  const notes = useNotesStore((state) => state.notes);
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const currentNotePageIndex = useNotesStore((state) => state.currentNotePageIndex);
  const editorDirty = useNotesStore((state) => state.editorDirty);
  const setCurrentNoteId = useNotesStore((state) => state.setCurrentNoteId);
  const setCurrentNotePageIndex = useNotesStore((state) => state.setCurrentNotePageIndex);
  const markEditorDirty = useNotesStore((state) => state.markEditorDirty);
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
  const toggleDesktopSidebarPinned = useUiStore((state) => state.toggleDesktopSidebarPinned);

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
    const note = addNote({ title: "", content: "", folderId: activeFolderId, userTags: [] }, "local-user");
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
    <main className="app-layout overflow-x-hidden text-foreground">
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
          <button aria-label="Закрыть меню" className="absolute inset-0 bg-foreground/42 backdrop-blur-sm" onClick={closeMobileSidebar} type="button" />
        <div className="absolute inset-y-0 left-0 w-[min(calc(100vw-1rem),24rem)] translate-x-2 max-w-none">
          <Sidebar copy={copy} currentView={view} folderViewMode={folderViewMode} folders={folders} activeFolderId={activeFolderId} onClose={closeMobileSidebar} onCreateFolder={(anchor) => openSheet("create-folder", anchor)} onOpenFolder={openFolder} onOpenSheet={openSheet} onSwitchView={openView} />
        </div>
      </div>
      ) : null}

      <button className="btn-fab fixed bottom-5 right-5 z-30 flex h-16 w-16 items-center justify-center bg-accent text-accent-foreground shadow-2xl shadow-violet-950/24" onClick={createNoteDraft} type="button">
        <Plus className="h-7 w-7" />
      </button>

      {editorOpen && currentNote ? <EditorOverlay note={currentNote} onClose={closeEditor} onOpenSheet={openSheet} toolbarVisible={toolbarVisible} setToolbarVisible={setToolbarVisible} /> : null}
      <BottomSheet activeFolder={activeFolder} editorDirty={editorDirty} isDesktop={isDesktop} sheet={sheet} onClose={() => setSheet(null)} />
    </main>
  );
}

function Header({ copy, view, activeFolder, searchQuery, filtersOpen, filtersRef, onOpenDrawer, onOpenFilters, onOpenFolderMenu, profileOpen, profileRef, setProfileOpen, setSearchQuery }: { copy: ReturnType<typeof getUiCopy>; view: AppView; activeFolder: FolderEntity | null; searchQuery: string; filtersOpen: boolean; filtersRef: React.RefObject<HTMLDivElement | null>; onOpenDrawer: () => void; onOpenFilters: () => void; onOpenFolderMenu: (anchor: SheetAnchor) => void; profileOpen: boolean; profileRef: React.RefObject<HTMLDivElement | null>; setProfileOpen: (open: boolean) => void; setSearchQuery: (query: string) => void }) {
  const title =
    view === "folder" && activeFolder
      ? activeFolder.name
      : view === "folders"
        ? copy.shell.folders
        : view === "favorites"
          ? copy.shell.favorites
          : view === "archive"
            ? copy.shell.archive
            : view === "reminders"
              ? copy.shell.reminders
              : view === "locked"
                ? copy.shell.locked
                : view === "hidden_folders"
                  ? copy.shell.hiddenFolders
                  : view === "admin_tools"
                    ? copy.shell.adminTools
                    : view === "trash"
                      ? copy.shell.trash
                      : copy.shell.notes;

  return (
    <header className="top-bar sticky top-0 z-20 px-3 py-3 shadow-lg shadow-violet-950/5 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-foreground/72 lg:hidden" onClick={onOpenDrawer} type="button">
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-lg font-black tracking-tight">{title}</h1>
          {view === "folder" ? <button className="rounded-full p-2 text-foreground/45 hover:bg-surface-strong" onClick={(event) => onOpenFolderMenu(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-4 w-4" /></button> : null}
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 shadow-inner shadow-violet-950/4">
            <Search className="h-5 w-5 shrink-0 text-foreground/38" />
            <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/38" onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.shell.search} value={searchQuery} />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative shrink-0" ref={filtersRef}>
            <button className={`flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-bold ${filtersOpen ? "bg-foreground text-background" : "bg-surface-strong text-foreground/72"}`} onClick={onOpenFilters} type="button">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">{copy.shell.filters}</span>
            </button>
          </div>

          <div className="relative shrink-0" ref={profileRef}>
            <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-strong" onClick={() => setProfileOpen(!profileOpen)} type="button">
              <UserRound className="h-5 w-5" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(92vw,18rem)] rounded-[1.5rem] border border-border bg-surface p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl lg:w-72">
                <div className="rounded-2xl bg-surface-strong p-3">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-black">Alex Smart</p>
                    <button className="rounded-full p-2 text-foreground/48 hover:bg-background" type="button">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <button className="mt-2 flex w-full items-center justify-between rounded-xl bg-background/70 px-3 py-2 text-left text-xs font-bold text-foreground/56" type="button">
                    UID: user_2f9b...91
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-500" type="button">
                  <LogOut className="h-4 w-4" />
                  {copy.shell.logout}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 lg:hidden">
        <label className="mx-auto flex min-h-12 w-full max-w-[32rem] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 shadow-inner shadow-violet-950/4">
          <Search className="h-5 w-5 shrink-0 text-foreground/38" />
          <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/38" onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.shell.search} value={searchQuery} />
        </label>
      </div>
    </header>
  );
}

function Sidebar({ copy, currentView, folders, folderViewMode, activeFolderId, isDesktop = false, onClose, onCreateFolder, onOpenFolder, onOpenSheet, onSwitchView }: { copy: ReturnType<typeof getUiCopy>; currentView: AppView; folders: FolderEntity[]; folderViewMode: "compact" | "full"; activeFolderId: string | null; isDesktop?: boolean; onClose: () => void; onCreateFolder: (anchor: SheetAnchor) => void; onOpenFolder: (folder: FolderEntity) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; onSwitchView: (view: AppView) => void }) {
  return (
    <aside className="sidebar-glass panel-card flex h-full flex-col overflow-hidden p-3 shadow-2xl shadow-violet-950/10">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">SmartNotes</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{copy.shell.menuTitle}</h1>
        </div>
        {!isDesktop ? (
          <button className="rounded-2xl border border-border bg-surface-strong p-2" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="sidebar-nav min-h-0 flex flex-1 flex-col overflow-y-auto overscroll-contain pr-0">
      <nav className="mt-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button className={`flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left text-sm font-semibold transition ${currentView === item.view ? "border-accent bg-foreground text-background" : "border-transparent text-foreground/70 hover:border-border hover:bg-surface-strong"}`} key={item.key} onClick={() => onSwitchView(item.view)} type="button">
              <Icon className="h-4 w-4" />
              <span>{copy.shell[item.key]}</span>
            </button>
          );
        })}
      </nav>

      <SidebarSection action={copy.shell.createFolder} onAction={(event) => onCreateFolder(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} title={copy.shell.folders}>
        {folders.map((folder) => (
          <button className={`flex w-full items-start gap-3 rounded-2xl border p-2.5 text-left transition ${activeFolderId === folder.id && currentView === "folder" ? "border-accent bg-accent/10" : "border-transparent hover:border-border hover:bg-surface-strong"}`} key={folder.id} onClick={() => onOpenFolder(folder)} type="button">
            <Folder className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              <span className="block text-sm font-semibold">{folder.name}</span>
              {folderViewMode === "full" && folder.description ? <span className="mt-1 line-clamp-2 block text-xs text-foreground/48">{folder.description}</span> : null}
            </span>
          </button>
        ))}
      </SidebarSection>

      <div className="mt-auto grid gap-2 pt-3">
        <button className="rounded-2xl border border-border bg-surface-strong px-4 py-3 text-left text-sm font-bold hover:bg-background" onClick={(event) => onOpenSheet("about", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button">
          {copy.shell.about}
        </button>
        <Button asChild variant="secondary">
          <Link href="/settings">{copy.common.settings}</Link>
        </Button>
      </div>
      </div>
    </aside>
  );
}

function SidebarSection({ title, action, children, onAction }: { title: string; action?: string; children: React.ReactNode; onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/42">{title}</h2>
        {action ? <button className="text-xs font-black text-accent" onClick={onAction} type="button">{action}</button> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function MainSurface({ copy, view, folders, hiddenFolders, trashedFolders, notes, activeFolder, folderViewMode, notesPerPage, onOpenFolder, onOpenNote, onOpenSheet }: { copy: ReturnType<typeof getUiCopy>; view: AppView; folders: FolderEntity[]; hiddenFolders: FolderEntity[]; trashedFolders: FolderEntity[]; notes: Note[]; activeFolder: FolderEntity | null; folderViewMode: "compact" | "full"; notesPerPage: 5 | 10 | 20 | 50; onOpenFolder: (folder: FolderEntity) => void; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
  if (view === "admin_tools") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><AdminToolsView notes={notes} /></section>;
  }

  if (view === "hidden_folders") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText={copy.shell.hiddenFolders} folderViewMode={folderViewMode} folders={hiddenFolders} mode="hidden" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "folders") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText={copy.shell.folders} folderViewMode={folderViewMode} folders={folders} mode="active" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "trash") {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><TrashView copy={copy} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} trashedFolders={trashedFolders} /></section>;
  }

  if (view === "folder" && activeFolder) {
    return <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><NotesView copy={copy} emptyText={copy.shell.prompts.noMatches} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={activeFolder.name} view={view} /></section>;
  }

  return (
    <section className="panel-card min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl">
      <NotesView
        copy={copy}
        emptyText="Здесь пока пусто"
        notes={notes}
        notesPerPage={notesPerPage}
        onOpenNote={onOpenNote}
        onOpenSheet={onOpenSheet}
        title={
          view === "favorites"
          ? copy.shell.favorites
            : view === "archive"
              ? copy.shell.archive
              : view === "reminders"
                ? copy.shell.reminders
                : view === "locked"
                  ? copy.shell.locked
                  : copy.shell.notes
        }
        view={view}
      />
    </section>
  );
}

function FoldersGrid({ folders, mode, emptyText, folderViewMode, onOpenFolder }: { folders: FolderEntity[]; mode: "active" | "hidden"; emptyText: string; folderViewMode: "compact" | "full"; onOpenFolder: (folder: FolderEntity) => void }) {
  const notes = useNotesStore((state) => state.notes);

  if (!folders.length) {
    return (
    <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-foreground/6 text-foreground/34"><Folder className="h-9 w-9" /></div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{emptyText}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`folder-grid grid gap-5 p-4 sm:p-5 ${folderViewMode === "compact" ? "sm:grid-cols-4 xl:grid-cols-5" : "sm:grid-cols-3 xl:grid-cols-4"}`}>
      {folders.map((folder) => {
        const notesCount = notes.filter((note) => note.folderId === folder.id && !note.trashedAt).length;

        return (
            <div className="folder-card rounded-[1.6rem] border border-border bg-surface-strong p-7 text-left shadow-lg shadow-violet-950/4" key={folder.id}>
            <button className="block w-full text-left" onClick={() => onOpenFolder(folder)} type="button">
              <div className="flex items-center gap-2 text-accent"><Folder className="h-5 w-5" /></div>
              <h2 className="mt-4 text-[1.45rem] font-black tracking-tight">{folder.name}</h2>
              {folder.description ? <p className={`mt-2 text-sm text-foreground/56 ${folderViewMode === "compact" ? "line-clamp-2 leading-6" : "line-clamp-4 leading-7"}`}>{folder.description}</p> : null}
            </button>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-foreground/56">
              <span>{notesCount} заметок</span>
              {mode === "hidden" ? <button className="rounded-xl bg-background px-3 py-2 font-bold text-accent" onClick={() => unhideFolder(folder.id)} type="button">Показать</button> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrashView({ copy, notes, notesPerPage, trashedFolders, onOpenNote, onOpenSheet }: { copy: ReturnType<typeof getUiCopy>; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; trashedFolders: FolderEntity[]; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
  return (
    <div className="content-scrollable space-y-6 p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">{copy.shell.trash}</h2>
      </div>

      {trashedFolders.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.deletedFolders}</div>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {trashedFolders.map((folder) => (
              <div className="rounded-[1.2rem] border border-dashed border-rose-300 bg-surface-strong p-5" key={folder.id}>
                <h3 className="text-base font-black tracking-tight">{folder.name}</h3>
                <p className="mt-2 text-sm text-foreground/56">{folder.description}</p>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-accent" onClick={() => restoreFolder(folder.id)} type="button">{copy.shell.actions.restore}</button>
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-rose-500" onClick={() => permanentlyDeleteFolder(folder.id)} type="button">{copy.shell.actions.delete}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <NotesView copy={copy} emptyText={copy.shell.sections.trashEmpty} notes={notes} notesPerPage={notesPerPage} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} title={copy.shell.trash} view="trash" />
    </div>
  );
}

function NotesView({ copy, title, notes, notesPerPage, emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const folders = useFoldersStore((state) => state.folders);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);
  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);
  const pinnedVisible = pinned.slice(0, notesPerPage);
  const unpinnedVisible = unpinned.slice(0, Math.max(notesPerPage - pinnedVisible.length, 0));
  if (!notes.length) {
    return (
      <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-border bg-surface-strong px-6 py-8 shadow-xl shadow-violet-950/6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-accent/10 text-accent"><Sparkles className="h-9 w-9" /></div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Здесь пока пусто</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/58">Создайте первую заметку, чтобы она появилась в этом разделе.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-scrollable space-y-5 p-3 sm:p-4">
      <div>
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
      </div>

      {pinnedVisible.length ? (
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-accent">
            <Heart className="h-4 w-4" />
            {copy.shell.sections.pinned}
          </div>
          <div className="notes-grid">
            {pinnedVisible.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
            ))}
          </div>
        </section>
      ) : null}

      {unpinnedVisible.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">{copy.shell.sections.notes}</div>
          <div className="notes-grid">
            {unpinnedVisible.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} onOpenSheet={onOpenSheet} view={view} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NoteCard({ note, folders, onOpenNote, onOpenSheet, view }: { note: Note; folders: FolderEntity[]; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor: SheetAnchor) => void; view: AppView }) {
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const setCurrentNoteId = useNotesStore((state) => state.setCurrentNoteId);

  const previewText = note.lock?.hidden ? maskLockedPreview(note.id) : stripHtml(note.content);
  const reminderLabel = note.reminderAt
    ? new Date(note.reminderAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  const aiBadgeTone = note.aiStatus === "error" ? "text-rose-500 bg-rose-500/10" : note.aiStatus === "pending" ? "text-amber-600 bg-amber-500/10" : note.aiStatus === "analyzing" ? "text-sky-600 bg-sky-500/10" : "text-emerald-600 bg-emerald-500/10";
  function openReminderSheet(anchor: SheetAnchor) {
    setCurrentNoteId(note.id);
    onOpenSheet("reminder", anchor);
    setFolderPickerOpen(false);
  }

  return (
    <article className={`note-card relative overflow-visible rounded-[1.35rem] border bg-surface-strong p-5 text-left shadow-md shadow-violet-950/4 transition hover:-translate-y-0.5 hover:shadow-lg border-border ${note.trashedAt ? "border-dashed border-rose-300" : "border-border"}`}>
      <div className="absolute right-2 top-2 z-10 flex items-start gap-1">
        {view === "trash" ? null : (
          <>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background ${note.pinned ? "text-accent" : ""}`} onClick={() => togglePinned(note.id)} type="button">
              <PinGlyph active={note.pinned} />
            </button>
            <button className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 backdrop-blur hover:bg-background ${note.favorite ? "text-rose-500" : "text-foreground/56"}`} onClick={() => toggleFavorite(note.id)} type="button">
              <Heart className={`h-4 w-4 ${note.favorite ? "fill-current" : ""}`} />
            </button>
          </>
        )}

        <div className="relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background" onClick={(event) => { setCurrentNoteId(note.id); onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect())); }} type="button">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button className="block w-full text-left" onClick={() => onOpenNote(note.id)} type="button">
        <div className="flex min-h-7 flex-wrap items-center gap-2 pr-20 text-[11px] font-black uppercase tracking-[0.18em] text-foreground/42">
          {note.reminderAt ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{reminderLabel}</span> : null}
          {note.lock ? <span className="rounded-full bg-foreground/8 px-2 py-1">Locked</span> : null}
          {note.isArchived ? <span className="rounded-full bg-foreground/8 px-2 py-1">Archive</span> : null}
          <span className={`rounded-full px-2 py-1 ${aiBadgeTone}`}>AI: {note.aiStatus}</span>
        </div>
        <h3 className="mt-2 pr-20 text-lg leading-6 font-black tracking-tight">{note.title}</h3>
        <p className={`mt-2 line-clamp-3 text-[0.95rem] leading-7 text-foreground/58 ${note.lock?.hidden ? "select-none" : ""}`}>{previewText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {note.userTags.map((tag) => (
            <span className="rounded-full border border-border px-3.5 py-1 text-xs font-semibold text-foreground/56" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      </button>
    </article>
  );
}

function PinGlyph({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 ${active ? "fill-current" : ""}`} viewBox="0 0 24 24">
      <path d="M15 3a1 1 0 0 1 .7 1.7l-1.47 1.46 4.61 4.61a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42 0l-1.41-1.42-3.89 3.9v4.25a1 1 0 0 1-1.7.7l-1-1a1 1 0 0 1-.3-.7v-3.25l3.9-3.89-4.62-4.62L5.3 8.7A1 1 0 0 1 3.6 8l1.06-1.06a1 1 0 0 1 1.41 0L10.68 11l3.9-3.9-1.29-1.28A1 1 0 0 1 14 3h1Z" />
    </svg>
  );
}

function TopFiltersPopup({ notesFilter, folders, tagDraft, tagSuggestions, onSetNotesSort, onToggleFolderFilter, onToggleTagFilter, onSetUpdatedWindowDays, onResetFilters, onTagDraftChange }: { notesFilter: { sort: NotesSort; folders: Array<string | null>; tags: string[]; updatedWindowDays: number | null }; folders: FolderEntity[]; tagDraft: string; tagSuggestions: string[]; onSetNotesSort: (sort: NotesSort) => void; onToggleFolderFilter: (folderId: string | null) => void; onToggleTagFilter: (tag: string) => void; onSetUpdatedWindowDays: (days: number | null) => void; onResetFilters: () => void; onTagDraftChange: (value: string) => void }) {
  return (
    <section className="filter-menu pointer-events-auto fixed right-3 top-[4.8rem] z-30 w-[min(calc(100vw-2rem),22rem)] max-h-[min(calc(100vh-6rem),32rem)] overflow-y-auto rounded-[1.4rem] border border-border bg-surface/96 p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl sm:right-4 sm:w-[min(92vw,25rem)] sm:max-h-[calc(100vh-6rem)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/54">Фильтры</h2>
        <button className="rounded-full border border-border bg-surface-strong px-3 py-1.5 text-xs font-bold" onClick={onResetFilters} type="button">Сбросить</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sortOptions.map((option) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.sort === option.value ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={option.value} onClick={() => onSetNotesSort(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{[7, 30, null].map((days) => (<button className={`rounded-2xl border px-3 py-2 text-left text-sm font-bold ${notesFilter.updatedWindowDays === days ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={String(days)} onClick={() => onSetUpdatedWindowDays(days)} type="button">{days === null ? "За все время" : `${days} дней`}</button>))}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.folders.includes(null) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} onClick={() => onToggleFolderFilter(null)} type="button">
          Без папки
        </button>
        {folders.map((folder) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.folders.includes(folder.id) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={folder.id} onClick={() => onToggleFolderFilter(folder.id)} type="button">
            {folder.name}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-surface-strong p-3">
        <label className="block text-sm font-bold text-foreground/66">Тег</label>
        <input className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none" onChange={(event) => onTagDraftChange(event.target.value)} placeholder="Начни вводить тег" value={tagDraft} />
        {tagSuggestions.length ? <div className="mt-3 flex flex-wrap gap-2">{tagSuggestions.map((tag) => <button className={`rounded-full border px-3 py-1.5 text-sm font-bold ${notesFilter.tags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={tag} onClick={() => onToggleTagFilter(tag)} type="button">#{tag}</button>)}</div> : <p className="mt-3 text-sm text-foreground/52">Совпадений пока нет.</p>}
        {tagDraft.trim() ? <button className="mt-3 rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold" onClick={() => onToggleTagFilter(tagDraft.trim())} type="button">Применить тег `#{tagDraft.trim()}`</button> : null}
      </div>
    </section>
  );
}

function EditorOverlay({ note, onClose, onOpenSheet, toolbarVisible, setToolbarVisible }: { note: Note; onClose: () => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; toolbarVisible: boolean; setToolbarVisible: (visible: boolean) => void }) {
  const currentNotePageIndex = useNotesStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNotesStore((state) => state.setCurrentNotePageIndex);
  const snapshotRef = useRef(serializeEditorSnapshot(note));
  const currentPage = note.pages[currentNotePageIndex] ?? note.pages[0];
  const editorDirty = useNotesStore((state) => state.editorDirty);
  const markEditorDirty = useNotesStore((state) => state.markEditorDirty);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false } }),
      LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: plainTextToEditorContent(currentPage.content),
    immediatelyRender: false,
    onUpdate: ({ editor: tiptapEditor }) => {
      const nextContent = tiptapEditor.getHTML();
      updatePage(note.id, currentPage.id, { content: nextContent });
      markEditorDirty(
        serializeEditorSnapshot({
          ...note,
          content: nextContent,
          pages: note.pages.map((page) => (page.id === currentPage.id ? { ...page, content: nextContent } : page)),
        }) !== snapshotRef.current,
      );
    },
  });

  useEffect(() => {
    if (currentNotePageIndex > note.pages.length - 1) {
      setCurrentNotePageIndex(Math.max(0, note.pages.length - 1));
    }
  }, [currentNotePageIndex, note.pages.length, setCurrentNotePageIndex]);

  useEffect(() => {
    snapshotRef.current = serializeEditorSnapshot(note);
    markEditorDirty(false);
    setCurrentNotePageIndex(0);
  }, [markEditorDirty, note.id, setCurrentNotePageIndex]);

  useEffect(() => {
    editor?.commands.setContent(plainTextToEditorContent(currentPage.content), { emitUpdate: false });
  }, [currentPage.content, currentPage.id, editor]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markEditorDirty, onClose]);

  function syncDirtyState(nextSnapshot: string) {
    markEditorDirty(nextSnapshot !== snapshotRef.current);
  }

  function handleClose() {
    syncDirtyState(serializeEditorSnapshot(note));
    onClose();
  }

  function handleTitleChange(value: string) {
    const nextTitle = value || currentPage.title || "Untitled note";
    patchNote(note.id, { title: nextTitle }, { scheduleAnalysis: false });
    syncDirtyState(
      serializeEditorSnapshot({
        ...note,
        title: nextTitle,
      }),
    );
  }

  function handleTagsBlur(value: string) {
    const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    patchNote(note.id, { userTags: tags }, { scheduleAnalysis: false });
    syncDirtyState(
      serializeEditorSnapshot({
        ...note,
        userTags: tags,
      }),
    );
  }

  if (!editor) {
    return null;
  }

  if (!currentPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3 sm:px-5">
        <header className="flex items-center gap-2 rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8">
          <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={handleClose} type="button"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-1 rounded-2xl bg-surface-strong px-2 py-1 text-sm font-black">
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex === 0} onClick={() => setCurrentNotePageIndex(Math.max(0, currentNotePageIndex - 1))} type="button"><ChevronLeft className="h-4 w-4" /></button>
            {currentNotePageIndex + 1}/{note.pages.length}
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex >= note.pages.length - 1} onClick={() => setCurrentNotePageIndex(Math.min(note.pages.length - 1, currentNotePageIndex + 1))} type="button"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Folder className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-1">
            <button className="rounded-2xl p-3 hover:bg-surface-strong" type="button"><Undo2 className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" type="button"><Share2 className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={(event) => onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-5 w-5" /></button>
          </div>
        </header>

        <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 sm:p-8">
          <input className="w-full bg-transparent text-3xl font-black tracking-tight outline-none placeholder:text-foreground/28 sm:text-5xl" onChange={(event) => handleTitleChange(event.target.value)} placeholder="Заголовок" value={note.title} />
          {toolbarVisible ? (
            <div className="sticky top-0 z-10 mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-strong/92 p-2 backdrop-blur-xl">
              <ToolButton active={editor.isActive("bold")} icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
              <ToolButton active={editor.isActive("italic")} icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
              <ToolButton active={editor.isActive("underline")} icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
              <ToolButton active={editor.isActive("strike")} icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} />
              <ToolButton active={editor.isActive({ textAlign: "left" })} icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
              <ToolButton active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
              <ToolButton active={editor.isActive({ textAlign: "right" })} icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
              <ToolButton active={editor.isActive("bulletList")} icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <ToolButton active={editor.isActive("link")} label="Link" onClick={() => { const url = window.prompt("Ссылка"); if (url) { editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); } }} />
              <ToolButton icon={Paintbrush} label="Sketch" onClick={() => { addPage(note.id, `Sketch ${note.pages.length + 1}`); setCurrentNotePageIndex(note.pages.length); }} />
              <ToolButton icon={FileImage} label="Add image" onClick={() => { const url = window.prompt("Ссылка на изображение"); if (!url) return; attachMedia(note.id, { id: `media_${Date.now().toString(36)}`, provider: "google-drive", fileId: url, url, mimeType: "image/*", name: "Image", size: 0, thumbnailUrl: url }); }} />
            </div>
          ) : null}
          <div className="mt-5 flex min-h-[60vh] flex-1 rounded-[1.5rem] border border-border bg-background/36 p-4 text-lg leading-9 outline-none" onMouseDown={() => editor.chain().focus().run()}>
            <div className="min-h-full flex-1" onMouseDown={() => editor.chain().focus().run()}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        <footer className="mt-3 flex items-center gap-2 rounded-[1.5rem] border border-border bg-surface/92 p-2 shadow-xl shadow-violet-950/8">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-surface-strong px-3"><Tag className="h-4 w-4 text-accent" /><input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={note.userTags.join(", ")} onBlur={(event) => handleTagsBlur(event.target.value)} placeholder="tag1, tag2" /></label>
          <div className="text-xs font-bold text-foreground/48">{editorDirty ? "Есть несохраненные локальные изменения" : "Все изменения в локальном state"}</div>
          <Button className="h-11 rounded-2xl" onClick={handleClose} type="button"><Save className="mr-2 h-4 w-4" />Готово</Button>
        </footer>
      </div>
    </div>
  );
}

function BottomSheet({ sheet, activeFolder, editorDirty, isDesktop, onClose }: { sheet: SheetState; activeFolder: FolderEntity | null; editorDirty: boolean; isDesktop: boolean; onClose: () => void }) {
  if (!sheet) {
    return null;
  }

  const { name, anchor } = sheet;
  const title = name === "folder" ? "Папка" : name === "note" ? "Действия заметки" : name === "pages" ? "Страницы" : name === "lock" ? "Lock Center" : name === "create-folder" ? "Создать папку" : name === "reminder" ? "Напоминание" : "О приложении";
  const topSheet = name === "pages";
  const mobileSheet = !isDesktop;
  const folderPopup = name === "folder" && !!anchor && !mobileSheet;

  function renderSheetContent() {
    return (
      <section
        className={`absolute border border-border bg-surface p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl ${mobileSheet ? "inset-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[2rem]" : name === "note" ? "left-1/2 top-1/2 w-[min(92vw,28rem)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem]" : anchor ? "w-[min(92vw,24rem)] max-h-[82vh] overflow-y-auto rounded-[1.8rem]" : topSheet ? "inset-x-0 top-0 max-h-[86vh] overflow-y-auto rounded-b-[2rem] lg:left-1/2 lg:top-4 lg:w-[min(94vw,48rem)] lg:-translate-x-1/2 lg:rounded-[2rem]" : "inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[2rem] lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-[2rem]"}`}
        style={name === "note" || mobileSheet || !anchor ? undefined : { left: `${anchor.x}px`, top: `${anchor.y}px`, transform: `translate(-50%, ${anchor.placement === "above" ? "-100%" : "0"})` }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-xl font-black">{title}</h2>
          <button className="rounded-full p-2 hover:bg-surface-strong" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        {name === "folder" ? <FolderActionList activeFolder={activeFolder} /> : null}
        {name === "note" ? <NoteActionSheet /> : null}
        {name === "pages" ? <PagesContent /> : null}
        {name === "lock" ? <LockContent onClose={onClose} /> : null}
        {name === "about" ? <AboutContent /> : null}
        {name === "create-folder" ? <CreateFolderContent onClose={onClose} /> : null}
        {name === "reminder" ? <ReminderContent onClose={onClose} /> : null}
      </section>
    );
  }

  return (
    folderPopup ? (
      <div className="fixed inset-0 z-50 pointer-events-none">
        <button aria-label="Закрыть меню" className="absolute inset-0 pointer-events-auto bg-transparent" onClick={onClose} type="button" />
        <div className="pointer-events-auto absolute left-0 top-0">
          {renderSheetContent()}
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-50">
        <button className="absolute inset-0 bg-foreground/42 backdrop-blur-sm" onClick={onClose} type="button" />
        {renderSheetContent()}
      </div>
    )
  );
}

function NoteActionSheet() {
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const note = useNotesStore((state) => state.notes.find((item) => item.id === state.currentNoteId) ?? null);
  const folders = useFoldersStore((state) => state.folders);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  if (!currentNoteId || !note) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 pb-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <ActionCard label="Отметить для повторного анализа" onClick={() => patchNote(note.id, { aiStatus: "pending", aiProcessed: false, analyzed: false, aiError: null }, { scheduleAnalysis: false })} />
        <ActionCard label={note.lock ? "Разблокировать заметку" : "Заблокировать заметку"} onClick={() => void toggleNoteLock(note.id)} />
        <ActionCard label={note.isArchived ? "Вернуть из архива" : "Архивировать"} onClick={() => setArchived(note.id, !note.isArchived)} />
        <ActionCard destructive label="Удалить" onClick={() => trashNote(note.id)} />
        <ActionCard label="Копировать текст" onClick={() => void copyNoteText(note)} />
        <ActionCard label="Переместить в папку" onClick={() => setFolderPickerOpen((value) => !value)} />
        <ActionCard label="Напоминание" onClick={() => patchNote(note.id, { reminderAt: note.reminderAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, { scheduleAnalysis: false })} />
        <ActionCard label="Скачать файл для импорта" onClick={() => exportNoteForImport(note)} />
        <ActionCard label="Скачать TXT" onClick={() => exportNoteAsTxt(note)} />
        <ActionCard label="Экспорт PDF" onClick={() => exportNoteAsPdf(note)} />
      </div>

      {folderPickerOpen ? (
        <div className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-foreground/42">Папки</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionCard label="Без папки" onClick={() => { moveNoteToFolder(note.id, null); setFolderPickerOpen(false); }} />
            {visibleFolders.map((folder) => (
              <ActionCard key={folder.id} label={folder.name} onClick={() => { moveNoteToFolder(note.id, folder.id); setFolderPickerOpen(false); }} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 rounded-[1.5rem] border border-border bg-surface-strong p-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Ваш доступ: {note.access.length ? note.access[0].role : "локальный"}</div>
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Статус анализа: {note.aiStatus === "done" ? "готово" : note.aiStatus === "pending" ? "в очереди" : note.aiStatus === "analyzing" ? "анализируется" : "ошибка"}</div>
      </div>
    </div>
  );
}

function ActionCard({ label, onClick, destructive = false }: { label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${destructive ? "border-rose-200 bg-rose-500/6 text-rose-600 hover:bg-rose-500/10" : "border-border bg-surface-strong hover:bg-background"}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function FolderActionList({ activeFolder }: { activeFolder: FolderEntity | null }) {
  if (!activeFolder) {
    return null;
  }

  const folder = activeFolder;

  function handleRename() {
    const nextName = window.prompt("Новое имя папки", folder.name)?.trim();

    if (!nextName) {
      return;
    }

    renameFolder(folder.id, nextName);
  }

  function handleDelete() {
    if (!window.confirm(`Удалить папку «${folder.name}»?`)) {
      return;
    }

    trashFolder(folder.id);
  }

  return (
    <div className="mt-4 space-y-2">
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" type="button">Поделиться</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={handleRename} type="button">Переименовать</button>
      {folder.isHidden ? <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => unhideFolder(folder.id)} type="button">Показать</button> : <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => hideFolder(folder.id)} type="button">Скрыть</button>}
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-rose-500 hover:bg-surface-strong" onClick={handleDelete} type="button">Удалить</button>
    </div>
  );
}

function PagesContent() {
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const note = useNotesStore((state) => state.notes.find((item) => item.id === state.currentNoteId) ?? null);
  const currentNotePageIndex = useNotesStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNotesStore((state) => state.setCurrentNotePageIndex);

  if (!currentNoteId || !note) {
    return null;
  }

  const noteId = currentNoteId;

  function renamePage(pageId: string, currentTitle: string) {
    const nextTitle = window.prompt("Название страницы", currentTitle)?.trim();

    if (!nextTitle) {
      return;
    }

    updatePage(noteId, pageId, { title: nextTitle });
  }

  function removePage(pageId: string) {
    if (!window.confirm("Удалить страницу?")) {
      return;
    }

    deletePage(noteId, pageId);
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2">
        {note.pages.map((page, index) => (
          <div className={`flex items-center gap-3 rounded-2xl p-3 transition ${currentNotePageIndex === index ? "bg-accent/10 text-accent" : "bg-surface-strong hover:bg-background"}`} key={page.id}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setCurrentNotePageIndex(index)} type="button">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-sm font-black text-accent">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{page.title}</span>
            </button>
            <button className="rounded-xl p-2 text-foreground/60 hover:bg-background" onClick={() => renamePage(page.id, page.title)} type="button"><Pencil className="h-4 w-4" /></button>
            {note.pages.length > 1 ? <button className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-background" onClick={() => removePage(page.id)} type="button">Удалить</button> : null}
          </div>
        ))}
      </div>
      <Button className="w-full rounded-2xl" onClick={() => addPage(noteId)} type="button" variant="secondary">Добавить страницу</Button>
    </div>
  );
}

function LockContent({ onClose }: { onClose: () => void }) {
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const note = useNotesStore((state) => state.notes.find((item) => item.id === state.currentNoteId) ?? null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!currentNoteId || !note?.lock) {
    return null;
  }

  const noteId = currentNoteId;
  const currentLock = note.lock;

  async function handleUnlock() {
    const valid = await verifyNoteLock(currentLock, password);

    if (!valid) {
      setError("Неверный пароль");
      return;
    }

    patchNote(noteId, { lock: { ...currentLock, hidden: false } }, { scheduleAnalysis: false });
    setError(null);
    setPassword("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-foreground/58">Контент заметки скрыт до локальной verify-проверки. Preview уже замаскирован в карточке.</p><input autoComplete="off" className="h-12 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none" name={`lock_${noteId.slice(0, 6)}`} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль заметки" type="password" value={password} />{error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}<Button className="w-full rounded-2xl" onClick={() => void handleUnlock()} type="button">Unlock</Button></div>;
}

function AboutContent() {
  const lang = useThemeStore((state) => state.lang);
  const copy = getUiCopy(lang);

  return (
    <div className="mt-5 grid gap-3">
      <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{copy.shell.aboutUsTitle}</p>
        <h3 className="mt-3 text-2xl font-black">SmartNotes</h3>
        <p className="mt-2 text-sm leading-6 text-foreground/58">{copy.shell.aboutUsText}</p>
        <ul className="mt-4 space-y-2 text-sm text-foreground/70">
          <li>{copy.shell.aboutUsPoint1}</li>
          <li>{copy.shell.aboutUsPoint2}</li>
        </ul>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{copy.shell.rateUsTitle}</p>
        <h3 className="mt-3 text-2xl font-black">Rate us</h3>
        <p className="mt-2 text-sm leading-6 text-foreground/58">{copy.shell.rateUsText}</p>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button className="h-11 w-11 rounded-2xl border border-border bg-background font-black hover:bg-surface" key={value} type="button">{value}</button>
          ))}
        </div>
        <textarea className="mt-4 min-h-32 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none" placeholder={copy.shell.feedbackPlaceholder} />
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 rounded-2xl" type="button">{copy.shell.sendFeedback}</Button>
          <Button asChild className="rounded-2xl" variant="secondary"><a href="mailto:support@smartnotes.app">{copy.shell.support}</a></Button>
        </div>
      </section>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active = false, onClick }: { icon?: ComponentType<{ className?: string }>; label?: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black hover:bg-background ${active ? "bg-background text-accent" : ""}`} onClick={onClick} type="button">
      {Icon ? <Icon className="h-4 w-4" /> : label}
    </button>
  );
}

function CreateFolderContent({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");

  function handleCreate() {
    const normalized = name.trim();

    if (!normalized) {
      return;
    }

    addFolder({ name: normalized, description: null, isHidden: false }, "local-user");
    setName("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><input className="h-12 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none" onChange={(event) => setName(event.target.value)} placeholder="Введите название папки" value={name} /><Button className="w-full rounded-2xl" disabled={!name.trim()} onClick={handleCreate} type="button">Создать папку</Button></div>;
}

function ReminderContent({ onClose }: { onClose: () => void }) {
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const note = useNotesStore((state) => state.notes.find((item) => item.id === state.currentNoteId) ?? null);
  const [value, setValue] = useState(note?.reminderAt ? note.reminderAt.slice(0, 16) : "");

  useEffect(() => {
    if (!currentNoteId || !note) {
      return;
    }

    setValue(note.reminderAt ? note.reminderAt.slice(0, 16) : "");
    scheduleReminder(currentNoteId, note.reminderAt);
  }, [currentNoteId, note]);

  if (!currentNoteId || !note) {
    return null;
  }

  return <div className="mt-4 space-y-3"><input className="h-12 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none" onChange={(event) => setValue(event.target.value)} type="datetime-local" value={value} /><div className="grid grid-cols-2 gap-2"><Button className="rounded-2xl" disabled={!value} onClick={async () => { const reminderAt = new Date(value).toISOString(); setReminder(currentNoteId, reminderAt); scheduleReminder(currentNoteId, reminderAt); await requestNotificationPermission(); onClose(); }} type="button">Сохранить</Button><Button className="rounded-2xl" onClick={() => { setReminder(currentNoteId, null); scheduleReminder(currentNoteId, null); onClose(); }} type="button" variant="secondary">Очистить</Button></div></div>;
}

function AdminToolsView({ notes }: { notes: Note[] }) {
  const pending = notes.filter((note) => note.aiStatus === "pending").length;
  const failed = notes.filter((note) => note.aiStatus === "error").length;
  const analyzing = notes.filter((note) => note.aiStatus === "analyzing").length;
  const queued = listPendingAiAnalysis().length;
  const syncBacklog = listSyncQueue().length;

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { title: "AI pending / queued", value: `${pending} / ${queued}`, icon: Brain },
        { title: "AI analyzing / errors", value: `${analyzing} / ${failed}`, icon: Shield },
        { title: "Sync backlog", value: syncBacklog, icon: RotateCcw },
      ].map((card) => {
        const Icon = card.icon;

        return (
          <div className="rounded-[1.6rem] border border-border bg-surface-strong p-5 shadow-lg shadow-violet-950/4" key={card.title}>
            <div className="flex items-center gap-2 text-accent"><Icon className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">Admin</span></div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">{card.value}</h2>
            <p className="mt-2 text-sm text-foreground/56">{card.title}</p>
          </div>
        );
      })}
    </div>
  );
}
