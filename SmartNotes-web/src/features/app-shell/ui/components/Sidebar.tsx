import { Archive, Bell, EyeOff, Folder, Folders, Heart, Inbox, Lock, Shield, Trash2, X, GripVertical, Users, ChevronDown, Settings, Info, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { useRef } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from "framer-motion";

import type { Folder as FolderEntity } from "@/entities/folder";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { LogoMark } from "@/shared/ui/logo-mark";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { isAdminUser } from "@/features/auth/lib/admin-acl";

import { getSheetAnchor, type SheetAnchor, type SheetName } from "./shared";

type ShellNavKey = "notes" | "favorites" | "archive" | "reminders" | "locked" | "trash" | "folders" | "hiddenFolders" | "adminTools" | "invites";

const personalItems: Array<{ key: ShellNavKey; view: AppView; icon: LucideIcon }> = [
  { key: "notes", view: "notes", icon: Inbox },
  { key: "favorites", view: "favorites", icon: Heart },
  { key: "reminders", view: "reminders", icon: Bell },
  { key: "invites", view: "invites", icon: Users },
];

const organizeItems: Array<{ key: ShellNavKey; view: AppView; icon: LucideIcon }> = [
  { key: "locked", view: "locked", icon: Lock },
  { key: "hiddenFolders", view: "hidden_folders", icon: EyeOff },
];

const archiveItems: Array<{ key: ShellNavKey; view: AppView; icon: LucideIcon }> = [
  { key: "archive", view: "archive", icon: Archive },
  { key: "trash", view: "trash", icon: Trash2 },
];

type SidebarProps = {
  copy: ReturnType<typeof getUiCopy>;
  currentView: AppView;
  folders: FolderEntity[];
  folderViewMode: "compact" | "full";
  activeFolderId: string | null;
  isDesktop?: boolean;
  invitesCount?: number;
  onClose: () => void;
  onCreateFolder: (anchor: SheetAnchor) => void;
  onOpenFolder: (folder: FolderEntity) => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  onSwitchView: (view: AppView) => void;
};

function SortableFolderItem({ folder, isActive, folderViewMode, count, onOpenFolder }: { folder: FolderEntity; isActive: boolean; folderViewMode: "compact" | "full"; count: number; onOpenFolder: (folder: FolderEntity) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative w-full">
      <button 
        className={`group relative flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
          isActive 
            ? "text-accent font-bold" 
            : "text-foreground/70 hover:bg-surface-strong"
        }`} 
        onClick={() => onOpenFolder(folder)} 
        type="button"
      >
        {isActive && (
          <motion.div
            layoutId="active-sidebar-pill"
            className="absolute inset-0 rounded-2xl border border-accent bg-accent/15 ring-1 ring-accent/50"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <div 
          {...attributes} 
          {...listeners} 
          className="mt-0.5 cursor-grab touch-none text-foreground/20 hover:text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity z-20 relative" 
          onClick={(e) => e.stopPropagation()} 
        >
          <GripVertical className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 text-left flex items-start gap-2 pointer-events-none z-10 min-w-0">
          <Folder className={`mt-0.5 h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-accent" : "text-foreground/50"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground truncate">{folder.name}</span>
            {folderViewMode === "full" && folder.description ? <span className="mt-0.5 block line-clamp-1 text-xs text-foreground/48">{folder.description}</span> : null}
          </span>
        </div>
        {count > 0 && (
          <span className="text-[10px] font-mono font-bold bg-foreground/6 text-foreground/48 px-1.5 py-0.5 rounded-full self-center z-10 shrink-0 pointer-events-none select-none">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}

export const Sidebar = React.memo(function Sidebar({ copy, currentView, folders, folderViewMode, activeFolderId, isDesktop = false, invitesCount = 0, onClose, onCreateFolder, onOpenFolder, onOpenSheet, onSwitchView }: SidebarProps) {
  const logoClicksRef = useRef(0);
  const developerMode = useUiStore((s) => s.developerMode);
  const toggleDeveloperMode = useUiStore((s) => s.toggleDeveloperMode);
  const user = useAuthStore((state) => state.user);
  const { data: notes = [] } = useNotesFlat();

  const [foldersExpanded, setFoldersExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("smartnotes_sidebar_folders_expanded");
      return saved !== "false";
    }
    return true;
  });

  const toggleFolders = React.useCallback(() => {
    setFoldersExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("smartnotes_sidebar_folders_expanded", String(next));
      }
      return next;
    });
  }, []);

  const counts = React.useMemo(() => {
    const countsMap: Record<ShellNavKey, number> = {
      notes: 0,
      favorites: 0,
      archive: 0,
      reminders: 0,
      locked: 0,
      trash: 0,
      folders: 0,
      hiddenFolders: 0,
      invites: invitesCount,
      adminTools: 0,
    };

    notes.forEach((note) => {
      if (note.trashedAt) {
        countsMap.trash += 1;
        return;
      }

      if (note.lock) {
        countsMap.locked += 1;
        return;
      }

      if (note.isArchived) {
        countsMap.archive += 1;
      } else {
        countsMap.notes += 1;
        if (note.favorite) countsMap.favorites += 1;
        if (note.reminderAt) countsMap.reminders += 1;
      }
    });

    return countsMap;
  }, [notes, invitesCount]);

  const folderCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach((note) => {
      if (!note.trashedAt && !note.lock && !note.isArchived && note.folderId) {
        map[note.folderId] = (map[note.folderId] || 0) + 1;
      }
    });
    return map;
  }, [notes]);

  function handleLogoClick() {
    logoClicksRef.current += 1;
    if (logoClicksRef.current >= 7) {
      if (isAdminUser(user?.email)) {
        if (!developerMode) {
          toggleDeveloperMode();
        }
        onSwitchView("admin_tools");
      }
      logoClicksRef.current = 0;
    }
  }

  const renderNavItem = (item: { key: ShellNavKey; view: AppView; icon: LucideIcon }) => {
    const Icon = item.icon;
    const isActive = currentView === item.view;
    const count = counts[item.key];

    return (
      <button 
        className={`group relative flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
          isActive 
            ? "text-accent" 
            : "text-foreground/70 hover:bg-surface-strong"
        }`} 
        key={item.key} 
        onClick={() => onSwitchView(item.view)} 
        type="button"
      >
        {isActive && (
          <motion.div
            layoutId="active-sidebar-pill"
            className="absolute inset-0 rounded-2xl border border-accent bg-accent/15 ring-1 ring-accent/50"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-3">
          <Icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-accent" : "text-foreground/50"}`} />
          <span>{copy.shell[item.key]}</span>
        </span>
        <span className="relative z-10 flex items-center gap-2">
          {item.key === "invites" && invitesCount > 0 ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-background animate-pulse shrink-0">
              {invitesCount}
            </span>
          ) : (
            count > 0 && (
              <span className="text-[10px] font-mono font-bold bg-foreground/6 text-foreground/48 px-1.5 py-0.5 rounded-full select-none">
                {count}
              </span>
            )
          )}
        </span>
      </button>
    );
  };

  return (
    <aside className="sidebar-glass panel-card flex h-full flex-col overflow-hidden p-4 shadow-2xl shadow-violet-950/10">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogoClick}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent transition-transform hover:scale-105 active:scale-95 cursor-default"
            type="button"
          >
            <LogoMark className="h-7 w-7" />
          </button>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-accent select-none">SmartNotes</p>
        </div>
        {!isDesktop ? (
          <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-strong" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex flex-1 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-5">
          <div>
            <h2 className="mb-2 mt-1 px-3 text-[10.5px] font-black uppercase tracking-[0.22em] text-foreground/35 select-none">
              {copy.shell.personalGroup}
            </h2>
            <nav className="space-y-0.5">
              {personalItems.map(renderNavItem)}
            </nav>
          </div>

          <SidebarSection 
            action={copy.shell.createFolder} 
            onAction={(event) => onCreateFolder(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} 
            title={copy.shell.folders} 
            folders={folders}
            expanded={foldersExpanded}
            onToggle={toggleFolders}
          >
            <button
              className={`group relative flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
                currentView === "folders" 
                  ? "text-accent" 
                  : "text-foreground/70 hover:bg-surface-strong"
              }`}
              onClick={() => onSwitchView("folders")}
              type="button"
            >
              {currentView === "folders" && (
                <motion.div
                  layoutId="active-sidebar-pill"
                  className="absolute inset-0 rounded-2xl border border-accent bg-accent/15 ring-1 ring-accent/50"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <Folders className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${currentView === "folders" ? "text-accent" : "text-foreground/50"}`} />
                <span>{copy.shell.folders}</span>
              </span>
              {folders.length > 0 && (
                <span className="relative z-10 text-[10px] font-mono font-bold bg-foreground/6 text-foreground/48 px-1.5 py-0.5 rounded-full select-none">
                  {folders.length}
                </span>
              )}
            </button>

            {folders.length > 0 && <div className="h-px bg-border/40 my-1.5 mx-3" />}

            <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {folders.map((folder) => {
                const isActive = activeFolderId === folder.id && currentView === "folder";
                return <SortableFolderItem key={folder.id} folder={folder} isActive={isActive} folderViewMode={folderViewMode} count={folderCounts[folder.id] || 0} onOpenFolder={onOpenFolder} />;
              })}
            </SortableContext>
            {developerMode && isAdminUser(user?.email) ? (
              <button className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-all duration-200 active:scale-[0.98] ${currentView === "admin_tools" ? "text-accent" : "text-foreground/70 hover:bg-surface-strong"}`} onClick={() => onSwitchView("admin_tools")} type="button">
                {currentView === "admin_tools" && (
                  <motion.div
                    layoutId="active-sidebar-pill"
                    className="absolute inset-0 rounded-2xl border border-accent bg-accent/15 ring-1 ring-accent/50"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <Shield className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${currentView === "admin_tools" ? "text-accent" : "text-foreground/50"}`} />
                  <span>{copy.shell.adminTools}</span>
                </span>
              </button>
            ) : null}
          </SidebarSection>

          <div>
            <h2 className="mb-2 mt-1 px-3 text-[10.5px] font-black uppercase tracking-[0.22em] text-foreground/35 select-none">
              {copy.shell.organizeGroup}
            </h2>
            <nav className="space-y-0.5">
              {organizeItems.map(renderNavItem)}
            </nav>
          </div>

          <div>
            <h2 className="mb-2 mt-1 px-3 text-[10.5px] font-black uppercase tracking-[0.22em] text-foreground/35 select-none">
              {copy.shell.archiveGroup}
            </h2>
            <nav className="space-y-0.5">
              {archiveItems.map(renderNavItem)}
            </nav>
          </div>
        </div>

        <div className="mt-3 shrink-0 border-t border-border/80 pt-3 pr-1">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-strong/40 p-2.5 border border-border/60 transition-all duration-300 hover:bg-surface-strong/60 hover:border-border/80">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/20 font-black text-xs text-accent uppercase select-none">
                  {user?.displayName ? user.displayName[0] : (user?.email ? user.email[0] : "?")}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {user?.displayName || user?.email?.split("@")[0] || "Guest"}
                </span>
                {user?.displayName && user.email ? (
                  <span className="block truncate text-xs text-foreground/48 font-medium">
                    {user.email}
                  </span>
                ) : null}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={(event) => onOpenSheet("about", getSheetAnchor(event.currentTarget.getBoundingClientRect()))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/50 hover:bg-surface-strong hover:text-foreground transition-all duration-200 active:scale-95"
                type="button"
                title={copy.shell.about}
              >
                <Info className="h-4 w-4" />
              </button>
              <Link
                href="/settings"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/50 hover:bg-surface-strong hover:text-foreground transition-all duration-200 active:scale-95"
                title={copy.common.settings}
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});

import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";

function SidebarSection({ title, action, children, onAction, className, folders, expanded, onToggle }: { title: string; action?: string; children: React.ReactNode; onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void; className?: string; folders?: FolderEntity[]; expanded: boolean; onToggle: () => void }) {
  const { reorderFolders } = useFolderActions();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id && folders) {
      const oldIndex = folders.findIndex(f => f.id === active.id);
      const newIndex = folders.findIndex(f => f.id === over?.id);
      const newFolders = arrayMove(folders, oldIndex, newIndex);
      void reorderFolders(newFolders.map(f => f.id));
    }
  }

  return (
    <section className={className ?? "mt-0"}>
      <div className="mb-1.5 flex items-center justify-between px-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-left group"
          type="button"
        >
          <ChevronDown
            className={`h-3 w-3 text-foreground/35 transition-transform duration-200 ${
              expanded ? "" : "-rotate-90"
            }`}
          />
          <h2 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-foreground/35 group-hover:text-foreground/50 transition-colors select-none">
            {title}
          </h2>
        </button>
        {action && expanded ? (
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-foreground/35 hover:bg-surface-strong hover:text-accent transition-colors"
            onClick={onAction}
            type="button"
            title={action}
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {expanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-0.5">{children}</div>
        </DndContext>
      )}
    </section>
  );
}
