"use client";

import {
  Archive,
  Bell,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  EyeOff,
  Folder,
  FolderInput,
  Heart,
  Inbox,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { addFolder, hideFolder, permanentlyDeleteFolder, renameFolder, restoreFolder, trashFolder, unhideFolder } from "@/features/folders/model/folder-actions";
import { useFoldersStore } from "@/features/folders/model/folders-store";
import { addNote, addPage, deletePage, moveNoteToFolder, patchNote, permanentlyDeleteNote, restoreNote, setArchived, setReminder, toggleFavorite, togglePinned, trashNote, updatePage } from "@/features/notes/model/note-actions";
import { type NotesSort, selectPinnedGroups, selectVisibleNotes } from "@/features/notes/model/note-selectors";
import { useNotesStore } from "@/features/notes/model/notes-store";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { Button } from "@/shared/ui/button";

type SheetName = "filters" | "folder" | "note" | "pages" | "lock" | null;
type ThemePreset = "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";

const navItems: Array<{ label: string; view: AppView; icon: typeof Inbox }> = [
  { label: "Все записи", view: "notes", icon: Inbox },
  { label: "Важное", view: "favorites", icon: Heart },
  { label: "Архив", view: "archive", icon: Archive },
  { label: "Напоминания", view: "reminders", icon: Bell },
  { label: "Защищенные", view: "locked", icon: Lock },
  { label: "Корзина", view: "trash", icon: Trash2 },
  { label: "Папки", view: "folders", icon: Folder },
  { label: "Скрытые папки", view: "hidden_folders", icon: EyeOff },
  { label: "Админ", view: "admin_tools", icon: Shield },
];

const invites = ["Design workspace", "Shared family notes"];
const themePresets: Array<{ id: ThemePreset; label: string }> = [
  { id: "paper", label: "Paper" },
  { id: "smarthub", label: "SmartHub" },
  { id: "smartlib", label: "SmartLib" },
  { id: "cyber", label: "Cyber" },
  { id: "lego", label: "Lego" },
  { id: "classic", label: "Classic" },
];

const sortOptions: Array<{ label: string; value: NotesSort }> = [
  { label: "По времени", value: "updated" },
  { label: "AI relevance", value: "ai_relevance" },
  { label: "Важность", value: "importance" },
  { label: "Алфавит", value: "alphabet" },
];

export function SmartNotesShell() {
  const rawFolders = useFoldersStore((state) => state.folders);
  const notes = useNotesStore((state) => state.notes);
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const setCurrentNoteId = useNotesStore((state) => state.setCurrentNoteId);
  const view = useUiStore((state) => state.view);
  const activeFolderId = useUiStore((state) => state.activeFolderId);
  const searchQuery = useUiStore((state) => state.searchQuery);
  const notesFilter = useUiStore((state) => state.notesFilter);
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
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
  const [sheet, setSheet] = useState<SheetName>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [theme, setTheme] = useState<ThemePreset>("paper");
  const [isDesktop, setIsDesktop] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

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
    document.documentElement.dataset.theme = theme;

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    function syncViewport() {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);

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
  }, [desktopSidebarPinned, setDesktopSidebarOpen]);

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
    setCurrentNoteId(noteId);
    setEditorOpen(true);
  }

  function createNoteDraft() {
    const note = addNote({ title: "", content: "", folderId: activeFolderId, userTags: [] }, "local-user");
    setCurrentNoteId(note.id);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setCurrentNoteId(null);
  }

  const desktopSidebarVisible = isDesktop && (desktopSidebarPinned || desktopSidebarOpen);
  const contentShift = desktopSidebarVisible ? "lg:pl-[19.5rem]" : "lg:pl-0";

  return (
    <main className="min-h-screen text-foreground">
      <div className="relative min-h-screen">
        {desktopSidebarVisible ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[18rem] lg:block">
            <div className="pointer-events-auto h-full">
              <Sidebar currentView={view} desktopPinned={desktopSidebarPinned} folders={folders} isDesktop onClose={() => setDesktopSidebarOpen(false)} onOpenFolder={openFolder} onOpenSheet={setSheet} onPinSidebar={toggleDesktopSidebarPinned} onSwitchView={openView} />
            </div>
          </div>
        ) : null}

        <div className={`transition-[padding] duration-300 ${contentShift}`}>
          <Header activeFolder={activeFolder} filtersOpen={filtersOpen} onOpenDrawer={toggleSidebar} onOpenFilters={() => setFiltersOpen((value) => !value)} onOpenFolderMenu={() => setSheet("folder")} profileOpen={profileOpen} profileRef={profileRef} searchQuery={searchQuery} setProfileOpen={setProfileOpen} setSearchQuery={setSearchQuery} view={view} />

          {filtersOpen ? (
            <TopFiltersPopup
              desktopSidebarPinned={desktopSidebarPinned}
              folders={folders}
              notesFilter={notesFilter}
              tagOptions={tagOptions}
              theme={theme}
              onResetFilters={resetNotesFilter}
              onSetNotesSort={setNotesSort}
              onSetUpdatedWindowDays={setUpdatedWindowDays}
              onThemeChange={setTheme}
              onToggleFolderFilter={toggleFolderFilter}
              onTogglePinnedSidebar={toggleDesktopSidebarPinned}
              onToggleTagFilter={toggleTagFilter}
            />
          ) : null}

          <MainSurface activeFolder={activeFolder} folders={folders} hiddenFolders={hiddenFolders} notes={visibleNotes} onOpenFolder={openFolder} onOpenNote={openNote} trashedFolders={trashedFolders} view={view} />
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Закрыть меню" className="absolute inset-0 bg-foreground/42 backdrop-blur-sm" onClick={closeMobileSidebar} type="button" />
          <div className="absolute inset-y-0 left-0 w-[88vw] max-w-sm pr-10">
            <Sidebar currentView={view} desktopPinned={false} folders={folders} onClose={closeMobileSidebar} onOpenFolder={openFolder} onOpenSheet={setSheet} onPinSidebar={toggleDesktopSidebarPinned} onSwitchView={openView} />
          </div>
        </div>
      ) : null}

      <button className="fixed bottom-5 right-5 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-2xl shadow-violet-950/24" onClick={createNoteDraft} type="button">
        <Plus className="h-7 w-7" />
      </button>

      {editorOpen && currentNote ? <EditorOverlay note={currentNote} onClose={closeEditor} onOpenSheet={setSheet} toolbarVisible={toolbarVisible} setToolbarVisible={setToolbarVisible} /> : null}
      <BottomSheet activeFolder={activeFolder} name={sheet} onClose={() => setSheet(null)} />
    </main>
  );
}

function Header({ view, activeFolder, searchQuery, filtersOpen, onOpenDrawer, onOpenFilters, onOpenFolderMenu, profileOpen, profileRef, setProfileOpen, setSearchQuery }: { view: AppView; activeFolder: FolderEntity | null; searchQuery: string; filtersOpen: boolean; onOpenDrawer: () => void; onOpenFilters: () => void; onOpenFolderMenu: () => void; profileOpen: boolean; profileRef: React.RefObject<HTMLDivElement | null>; setProfileOpen: (open: boolean) => void; setSearchQuery: (query: string) => void }) {
  const title =
    view === "folder" && activeFolder
      ? activeFolder.name
      : view === "folders"
        ? "Папки"
        : view === "favorites"
          ? "Важное"
          : view === "archive"
            ? "Архив"
            : view === "reminders"
              ? "Напоминания"
              : view === "locked"
                ? "Защищенные"
                : view === "hidden_folders"
                  ? "Скрытые папки"
                  : view === "admin_tools"
                    ? "Админ-инструменты"
                    : view === "trash"
                      ? "Корзина"
                      : "Все записи";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/92 px-3 py-3 shadow-lg shadow-violet-950/5 backdrop-blur-2xl sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-foreground/72" onClick={onOpenDrawer} type="button">
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 shrink-0 items-center gap-2 lg:flex">
          <h1 className="truncate text-lg font-black tracking-tight">{title}</h1>
          {view === "folder" ? <button className="rounded-full p-2 text-foreground/45 hover:bg-surface-strong" onClick={onOpenFolderMenu} type="button"><MoreHorizontal className="h-4 w-4" /></button> : null}
        </div>

        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 shadow-inner shadow-violet-950/4">
          <Search className="h-5 w-5 shrink-0 text-foreground/38" />
          <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/38" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Поиск" value={searchQuery} />
        </label>

        <button className={`flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-bold ${filtersOpen ? "bg-foreground text-background" : "bg-surface-strong text-foreground/72"}`} onClick={onOpenFilters} type="button">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Фильтры</span>
        </button>

        <div className="relative shrink-0" ref={profileRef}>
          <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-strong" onClick={() => setProfileOpen(!profileOpen)} type="button">
            <UserRound className="h-5 w-5" />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-[1.5rem] border border-border bg-surface p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl">
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
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 lg:hidden">
        <h1 className="truncate text-base font-black tracking-tight">{title}</h1>
        {view === "folder" ? <button className="rounded-full p-2 text-foreground/45 hover:bg-surface-strong" onClick={onOpenFolderMenu} type="button"><MoreHorizontal className="h-4 w-4" /></button> : null}
      </div>
    </header>
  );
}

function Sidebar({ currentView, folders, isDesktop = false, onClose, onOpenFolder, onPinSidebar, onSwitchView }: { currentView: AppView; folders: FolderEntity[]; isDesktop?: boolean; desktopPinned: boolean; onClose: () => void; onOpenFolder: (folder: FolderEntity) => void; onOpenSheet: (sheet: SheetName) => void; onPinSidebar: () => void; onSwitchView: (view: AppView) => void }) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-surface/94 p-4 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">SmartNotes</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Меню</h1>
        </div>
        <button className="rounded-2xl border border-border bg-surface-strong p-2" onClick={isDesktop ? onPinSidebar : onClose} type="button">
          {isDesktop ? <Folder className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      <nav className="mt-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${currentView === item.view ? "bg-foreground text-background" : "text-foreground/70 hover:bg-surface-strong"}`} key={item.label} onClick={() => onSwitchView(item.view)} type="button">
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <SidebarSection title="Папки" action="Создать папку">
        {folders.map((folder) => (
          <button className="flex w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" key={folder.id} onClick={() => onOpenFolder(folder)} type="button">
            <Folder className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              <span className="block text-sm font-semibold">{folder.name}</span>
              <span className="mt-1 block text-xs text-foreground/48">{folder.description}</span>
            </span>
          </button>
        ))}
      </SidebarSection>

      <SidebarSection title="Приглашения">
        {invites.map((invite) => (
          <div className="rounded-2xl bg-surface-strong p-3" key={invite}>
            <p className="text-sm font-bold">{invite}</p>
          </div>
        ))}
      </SidebarSection>

      <div className="mt-auto grid gap-2 pt-4">
        <button className="rounded-2xl border border-border bg-surface-strong px-4 py-3 text-left text-sm font-bold hover:bg-background" type="button">
          О приложении
        </button>
        <Button asChild variant="secondary">
          <Link href="/settings">Настройки</Link>
        </Button>
      </div>
    </aside>
  );
}

function SidebarSection({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/42">{title}</h2>
        {action ? <button className="text-xs font-black text-accent" onClick={() => addFolder({ name: "Новая папка", description: null, isHidden: false }, "local-user")} type="button">{action}</button> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MainSurface({ view, folders, hiddenFolders, trashedFolders, notes, activeFolder, onOpenFolder, onOpenNote }: { view: AppView; folders: FolderEntity[]; hiddenFolders: FolderEntity[]; trashedFolders: FolderEntity[]; notes: Note[]; activeFolder: FolderEntity | null; onOpenFolder: (folder: FolderEntity) => void; onOpenNote: (noteId: string) => void }) {
  if (view === "admin_tools") {
    return <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><AdminToolsView notes={notes} /></section>;
  }

  if (view === "hidden_folders") {
    return <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText="Скрытых папок пока нет." folders={hiddenFolders} mode="hidden" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "folders") {
    return <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><FoldersGrid emptyText="Папки пока не созданы." folders={folders} mode="active" onOpenFolder={onOpenFolder} /></section>;
  }

  if (view === "trash") {
    return <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><TrashView notes={notes} onOpenNote={onOpenNote} trashedFolders={trashedFolders} /></section>;
  }

  if (view === "folder" && activeFolder) {
    return <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl"><NotesView emptyText="В этой папке пока нет заметок." notes={notes} onOpenNote={onOpenNote} title={activeFolder.name} view={view} /></section>;
  }

  return (
    <section className="min-h-[calc(100vh-4.8rem)] border-t border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl">
      <NotesView
        emptyText="Здесь пока пусто"
        notes={notes}
        onOpenNote={onOpenNote}
        title={
          view === "favorites"
            ? "Важное"
            : view === "archive"
              ? "Архив"
              : view === "reminders"
                ? "Напоминания"
                : view === "locked"
                  ? "Защищенные заметки"
                  : "Все записи"
        }
        view={view}
      />
    </section>
  );
}

function FoldersGrid({ folders, mode, emptyText, onOpenFolder }: { folders: FolderEntity[]; mode: "active" | "hidden"; emptyText: string; onOpenFolder: (folder: FolderEntity) => void }) {
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
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => {
        const notesCount = notes.filter((note) => note.folderId === folder.id && !note.trashedAt).length;

        return (
          <div className="rounded-[1.6rem] border border-border bg-surface-strong p-5 text-left shadow-lg shadow-violet-950/4" key={folder.id}>
            <button className="block w-full text-left" onClick={() => onOpenFolder(folder)} type="button">
              <div className="flex items-center gap-2 text-accent"><Folder className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">{mode === "hidden" ? "Скрытая папка" : "Папка"}</span></div>
              <h2 className="mt-4 text-xl font-black tracking-tight">{folder.name}</h2>
              <p className="mt-2 text-sm leading-7 text-foreground/56">{folder.description}</p>
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

function TrashView({ notes, trashedFolders, onOpenNote }: { notes: Note[]; trashedFolders: FolderEntity[]; onOpenNote: (noteId: string) => void }) {
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">Корзина</h2>
        <p className="mt-1 text-sm text-foreground/52">{notes.length + trashedFolders.length} объектов готовы к восстановлению или удалению.</p>
      </div>

      {trashedFolders.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">Удаленные папки</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trashedFolders.map((folder) => (
              <div className="rounded-[1.2rem] border border-dashed border-rose-300 bg-surface-strong p-4" key={folder.id}>
                <h3 className="text-base font-black tracking-tight">{folder.name}</h3>
                <p className="mt-2 text-sm text-foreground/56">{folder.description}</p>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-accent" onClick={() => restoreFolder(folder.id)} type="button">Restore</button>
                  <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-rose-500" onClick={() => permanentlyDeleteFolder(folder.id)} type="button">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <NotesView emptyText="Корзина пока пуста" notes={notes} onOpenNote={onOpenNote} title="Удаленные заметки" view="trash" />
    </div>
  );
}

function NotesView({ title, notes, emptyText, onOpenNote, view }: { title: string; notes: Note[]; emptyText: string; onOpenNote: (noteId: string) => void; view: AppView }) {
  const folders = useFoldersStore((state) => state.folders);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);
  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);

  if (!notes.length) {
    return (
      <div className="flex h-full min-h-[calc(100vh-7.5rem)] items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-foreground/6 text-foreground/34"><Sparkles className="h-9 w-9" /></div>
          <h2 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{emptyText}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-foreground/52">{notes.length} заметок в текущем представлении.</p>
      </div>

      {pinned.length ? (
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-accent">
            <Heart className="h-4 w-4" />
            Закрепленные
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pinned.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} view={view} />
            ))}
          </div>
        </section>
      ) : null}

      {unpinned.length ? (
        <section>
          <div className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-foreground/42">Заметки</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unpinned.map((note) => (
              <NoteCard key={note.id} folders={visibleFolders} note={note} onOpenNote={onOpenNote} view={view} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NoteCard({ note, folders, onOpenNote, view }: { note: Note; folders: FolderEntity[]; onOpenNote: (noteId: string) => void; view: AppView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setFolderPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const folderName = folders.find((folder) => folder.id === note.folderId)?.name ?? "Без папки";
  const reminderLabel = note.reminderAt
    ? new Date(note.reminderAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  function setQuickReminder() {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    setReminder(note.id, next.toISOString());
    setMenuOpen(false);
    setFolderPickerOpen(false);
  }

  return (
    <article className={`relative rounded-[1.35rem] border bg-surface-strong p-4 text-left shadow-md shadow-violet-950/4 transition hover:-translate-y-0.5 hover:shadow-lg ${note.trashedAt ? "border-dashed border-rose-300" : "border-border"}`}>
      <div className="absolute right-3 top-3 z-10 flex items-start gap-1">
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

        <div className="relative" ref={menuRef}>
          <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/92 text-foreground/56 backdrop-blur hover:bg-background" onClick={() => setMenuOpen((value) => !value)} type="button">
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.45rem)] z-20 w-64 rounded-[1.2rem] border border-border bg-surface p-2 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl">
              {view === "trash" ? (
                <div className="space-y-1">
                  <MenuAction icon={RotateCcw} label="Восстановить" onClick={() => { restoreNote(note.id); setMenuOpen(false); }} />
                  <MenuAction destructive icon={Trash2} label="Удалить навсегда" onClick={() => { permanentlyDeleteNote(note.id); setMenuOpen(false); }} />
                </div>
              ) : (
                <div className="space-y-1">
                  <MenuAction icon={Archive} label={note.isArchived ? "Вернуть из архива" : "В архив"} onClick={() => { setArchived(note.id, !note.isArchived); setMenuOpen(false); setFolderPickerOpen(false); }} />
                  <MenuAction icon={Bell} label={note.reminderAt ? "Убрать напоминание" : "Напомнить завтра в 09:00"} onClick={() => { if (note.reminderAt) { setReminder(note.id, null); setMenuOpen(false); setFolderPickerOpen(false); return; } setQuickReminder(); }} />
                  <MenuAction icon={FolderInput} label={`Переместить: ${folderName}`} onClick={() => setFolderPickerOpen((value) => !value)} />
                  {folderPickerOpen ? <div className="rounded-xl bg-surface-strong/72 p-1"> <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/36">Папки</div><div className="max-h-40 space-y-1 overflow-y-auto"><MenuAction active={note.folderId === null} icon={Folder} label="Без папки" onClick={() => { moveNoteToFolder(note.id, null); setMenuOpen(false); setFolderPickerOpen(false); }} />{folders.map((folder) => (<MenuAction active={note.folderId === folder.id} icon={Folder} key={folder.id} label={folder.name} onClick={() => { moveNoteToFolder(note.id, folder.id); setMenuOpen(false); setFolderPickerOpen(false); }} />))}</div></div> : null}
                  <div className="my-1 h-px bg-border" />
                  <MenuAction destructive icon={Trash2} label="Удалить" onClick={() => { trashNote(note.id); setMenuOpen(false); setFolderPickerOpen(false); }} />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <button className="block w-full text-left" onClick={() => onOpenNote(note.id)} type="button">
        <div className="flex min-h-7 flex-wrap items-center gap-2 pr-28 text-[11px] font-black uppercase tracking-[0.18em] text-foreground/42">
          {note.reminderAt ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">{reminderLabel}</span> : null}
          {note.lock ? <span className="rounded-full bg-foreground/8 px-2 py-1">Locked</span> : null}
          {note.isArchived ? <span className="rounded-full bg-foreground/8 px-2 py-1">Archive</span> : null}
          <span className="rounded-full border border-border px-2 py-1">{folderName}</span>
        </div>
        <h3 className="mt-2 pr-28 text-base leading-6 font-black tracking-tight">{note.title}</h3>
        <p className={`mt-2 line-clamp-3 text-sm leading-6 text-foreground/58 ${note.lock?.hidden ? "blur-[3px] select-none" : ""}`}>{note.content}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {note.userTags.map((tag) => (
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground/56" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      </button>
    </article>
  );
}

function MenuAction({ label, icon: Icon, onClick, destructive = false, active = false }: { label: string; icon: typeof Folder; onClick: () => void; destructive?: boolean; active?: boolean }) {
  return (
    <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${destructive ? "text-rose-500 hover:bg-rose-500/8" : active ? "bg-accent/10 text-accent" : "text-foreground/78 hover:bg-surface-strong"}`} onClick={onClick} type="button">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function PinGlyph({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 ${active ? "fill-current" : ""}`} viewBox="0 0 24 24">
      <path d="M15 3a1 1 0 0 1 .7 1.7l-1.47 1.46 4.61 4.61a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42 0l-1.41-1.42-3.89 3.9v4.25a1 1 0 0 1-1.7.7l-1-1a1 1 0 0 1-.3-.7v-3.25l3.9-3.89-4.62-4.62L5.3 8.7A1 1 0 0 1 3.6 8l1.06-1.06a1 1 0 0 1 1.41 0L10.68 11l3.9-3.9-1.29-1.28A1 1 0 0 1 14 3h1Z" />
    </svg>
  );
}

function TopFiltersPopup({ theme, desktopSidebarPinned, notesFilter, folders, tagOptions, onThemeChange, onTogglePinnedSidebar, onSetNotesSort, onToggleFolderFilter, onToggleTagFilter, onSetUpdatedWindowDays, onResetFilters }: { theme: ThemePreset; desktopSidebarPinned: boolean; notesFilter: { sort: NotesSort; folders: Array<string | null>; tags: string[]; updatedWindowDays: number | null }; folders: FolderEntity[]; tagOptions: string[]; onThemeChange: (theme: ThemePreset) => void; onTogglePinnedSidebar: () => void; onSetNotesSort: (sort: NotesSort) => void; onToggleFolderFilter: (folderId: string | null) => void; onToggleTagFilter: (tag: string) => void; onSetUpdatedWindowDays: (days: number | null) => void; onResetFilters: () => void }) {
  return (
    <section className="relative z-10 border-b border-border bg-surface/96 px-3 py-3 shadow-lg shadow-violet-950/5 backdrop-blur-2xl sm:px-4">
      <div className="flex flex-wrap gap-2">
        {sortOptions.map((option) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.sort === option.value ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={option.value} onClick={() => onSetNotesSort(option.value)} type="button">
            {option.label}
          </button>
        ))}
        <button className="rounded-full border border-border bg-surface-strong px-3 py-2 text-sm font-bold" onClick={onResetFilters} type="button">Сбросить</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-2xl border border-border bg-surface-strong px-4 py-3 text-left text-sm font-bold hover:bg-background" onClick={onTogglePinnedSidebar} type="button">
          {desktopSidebarPinned ? "Не держать панель открытой" : "Всегда держать панель открытой"}
        </button>
        {[7, 30, null].map((days) => (
          <button className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold ${notesFilter.updatedWindowDays === days ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={String(days)} onClick={() => onSetUpdatedWindowDays(days)} type="button">
            {days === null ? "За все время" : `${days} дней`}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {folders.map((folder) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.folders.includes(folder.id) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={folder.id} onClick={() => onToggleFolderFilter(folder.id)} type="button">
            {folder.name}
          </button>
        ))}
      </div>
      {tagOptions.length ? <div className="mt-3 flex flex-wrap gap-2">{tagOptions.slice(0, 10).map((tag) => <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.tags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={tag} onClick={() => onToggleTagFilter(tag)} type="button">#{tag}</button>)}</div> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {themePresets.map((preset) => (
          <button className={`rounded-xl border px-3 py-2 text-left text-sm font-black ${theme === preset.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={preset.id} onClick={() => onThemeChange(preset.id)} type="button">
            {preset.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function EditorOverlay({ note, onClose, onOpenSheet, toolbarVisible, setToolbarVisible }: { note: Note; onClose: () => void; onOpenSheet: (sheet: SheetName) => void; toolbarVisible: boolean; setToolbarVisible: (visible: boolean) => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const currentPage = note.pages[pageIndex] ?? note.pages[0];

  useEffect(() => {
    if (pageIndex > note.pages.length - 1) {
      setPageIndex(Math.max(0, note.pages.length - 1));
    }
  }, [note.pages.length, pageIndex]);

  if (!currentPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3 sm:px-5">
        <header className="flex items-center gap-2 rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8">
          <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={onClose} type="button"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-1 rounded-2xl bg-surface-strong px-2 py-1 text-sm font-black">
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))} type="button"><ChevronLeft className="h-4 w-4" /></button>
            {pageIndex + 1}/{note.pages.length}
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={pageIndex >= note.pages.length - 1} onClick={() => setPageIndex((value) => Math.min(note.pages.length - 1, value + 1))} type="button"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={() => onOpenSheet("pages")} type="button"><Folder className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-1">
            <button className="rounded-2xl p-3 hover:bg-surface-strong" type="button"><Undo2 className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" type="button"><Share2 className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={() => onOpenSheet("note")} type="button"><MoreHorizontal className="h-5 w-5" /></button>
            <button className="rounded-2xl p-3 hover:bg-surface-strong" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-5 w-5" /></button>
          </div>
        </header>

        <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 sm:p-8">
          <input className="w-full bg-transparent text-3xl font-black tracking-tight outline-none placeholder:text-foreground/28 sm:text-5xl" onChange={(event) => patchNote(note.id, { title: event.target.value || currentPage.title || "Untitled note" }, { scheduleAnalysis: false })} placeholder="Заголовок" value={note.title} />
          {toolbarVisible ? <div className="sticky top-0 z-10 mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-strong/92 p-2 backdrop-blur-xl">{["B", "I", "U", "List", "Link"].map((tool) => <button className="shrink-0 rounded-xl px-3 py-2 text-sm font-black hover:bg-background" key={tool} type="button">{tool}</button>)}</div> : null}
          <input className="mt-5 w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm font-semibold outline-none" maxLength={80} onChange={(event) => updatePage(note.id, currentPage.id, { title: event.target.value })} placeholder="Название страницы" value={currentPage.title} />
          <textarea className="mt-5 min-h-[52vh] w-full resize-none bg-transparent text-lg leading-9 outline-none" onChange={(event) => updatePage(note.id, currentPage.id, { content: event.target.value })} placeholder="Начни писать..." value={currentPage.content} />
        </section>

        <footer className="mt-3 flex items-center gap-2 rounded-[1.5rem] border border-border bg-surface/92 p-2 shadow-xl shadow-violet-950/8">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-surface-strong px-3"><Tag className="h-4 w-4 text-accent" /><input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={note.userTags.join(", ")} onBlur={(event) => patchNote(note.id, { userTags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }, { scheduleAnalysis: false })} placeholder="tag1, tag2" /></label>
          <Button className="h-11 rounded-2xl" onClick={onClose} type="button"><Save className="mr-2 h-4 w-4" />Готово</Button>
        </footer>
      </div>
    </div>
  );
}

function BottomSheet({ name, activeFolder, onClose }: { name: SheetName; activeFolder: FolderEntity | null; onClose: () => void }) {
  if (!name) {
    return null;
  }

  const title = name === "folder" ? "Папка" : name === "note" ? "Действия заметки" : name === "pages" ? "Страницы" : "Lock Center";

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-foreground/42 backdrop-blur-sm" onClick={onClose} type="button" />
      <section className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[2rem] border border-border bg-surface p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-[2rem]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/18 lg:hidden" />
        <div className="flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button className="rounded-full p-2 hover:bg-surface-strong" onClick={onClose} type="button"><X className="h-5 w-5" /></button></div>
        {name === "folder" ? <FolderActionList activeFolder={activeFolder} /> : null}
        {name === "note" ? <ActionList items={["Архивировать", "Заблокировать", "Переместить", "Напомнить", "Удалить"]} /> : null}
        {name === "pages" ? <PagesContent /> : null}
        {name === "lock" ? <LockContent /> : null}
      </section>
    </div>
  );
}

function ActionList({ items }: { items: string[] }) {
  return <div className="mt-4 space-y-2">{items.map((item) => <button className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong ${item.includes("Удал") ? "text-rose-500" : ""}`} key={item} type="button"><span className="font-bold">{item}</span></button>)}</div>;
}

function FolderActionList({ activeFolder }: { activeFolder: FolderEntity | null }) {
  if (!activeFolder) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" type="button">Поделиться</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => renameFolder(activeFolder.id, `${activeFolder.name} Updated`)} type="button">Переименовать</button>
      {activeFolder.isHidden ? <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => unhideFolder(activeFolder.id)} type="button">Показать</button> : <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => hideFolder(activeFolder.id)} type="button">Скрыть</button>}
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-rose-500 hover:bg-surface-strong" onClick={() => trashFolder(activeFolder.id)} type="button">Удалить</button>
    </div>
  );
}

function PagesContent() {
  const currentNoteId = useNotesStore((state) => state.currentNoteId);
  const note = useNotesStore((state) => state.notes.find((item) => item.id === state.currentNoteId) ?? null);

  if (!currentNoteId || !note) {
    return null;
  }

  return <div className="mt-4 space-y-2">{note.pages.map((page, index) => <div className="flex items-center gap-3 rounded-2xl bg-surface-strong p-3" key={page.id}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-sm font-black text-accent">{index + 1}</span><span className="flex-1 font-bold">{page.title}</span>{note.pages.length > 1 ? <button className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-background" onClick={() => deletePage(currentNoteId, page.id)} type="button">Удалить</button> : null}</div>)}<Button className="mt-2 w-full rounded-2xl" onClick={() => addPage(currentNoteId)} type="button" variant="secondary">Добавить страницу</Button></div>;
}

function LockContent() {
  return <div className="mt-4 space-y-3"><input className="h-12 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none" placeholder="Пароль заметки" type="password" /><Button className="w-full rounded-2xl">Unlock</Button></div>;
}

function AdminToolsView({ notes }: { notes: Note[] }) {
  const pending = notes.filter((note) => note.aiStatus === "pending").length;
  const failed = notes.filter((note) => note.aiStatus === "error").length;

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { title: "AI pending", value: pending, icon: Brain },
        { title: "AI errors", value: failed, icon: Shield },
        { title: "Sync backlog", value: 0, icon: RotateCcw },
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
