import { Archive, Bell, EyeOff, Folder, Heart, Inbox, Lock, Shield, Trash2, X, GripVertical, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { useRef } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Folder as FolderEntity } from "@/entities/folder";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView, useUiStore } from "@/shared/store/ui-store";
import { Button } from "@/shared/ui/button";
import { LogoMark } from "@/shared/ui/logo-mark";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { isAdminUser } from "@/features/auth/lib/admin-acl";

import { getSheetAnchor, type SheetAnchor, type SheetName } from "./shared";

type ShellNavKey = "notes" | "favorites" | "archive" | "reminders" | "locked" | "trash" | "folders" | "hiddenFolders" | "adminTools" | "invites";

const navItems: Array<{ key: ShellNavKey; view: AppView; icon: LucideIcon }> = [
  { key: "notes", view: "notes", icon: Inbox },
  { key: "favorites", view: "favorites", icon: Heart },
  { key: "archive", view: "archive", icon: Archive },
  { key: "reminders", view: "reminders", icon: Bell },
  { key: "locked", view: "locked", icon: Lock },
  { key: "trash", view: "trash", icon: Trash2 },
  { key: "folders", view: "folders", icon: Folder },
  { key: "hiddenFolders", view: "hidden_folders", icon: EyeOff },
  { key: "invites", view: "invites", icon: Users },
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


function SortableFolderItem({ folder, isActive, folderViewMode, onOpenFolder }: { folder: FolderEntity; isActive: boolean; folderViewMode: "compact" | "full"; onOpenFolder: (folder: FolderEntity) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative w-full">
      <button 
        className={`group flex w-full items-start gap-2 rounded-2xl border p-3 text-left transition ${
          isActive 
            ? "border-accent bg-accent/15 text-accent ring-1 ring-accent/50" 
            : "border-transparent hover:border-border hover:bg-surface-strong"
        }`} 
        onClick={() => onOpenFolder(folder)} 
        type="button"
      >
        <div 
          {...attributes} 
          {...listeners} 
          className="mt-0.5 cursor-grab touch-none text-foreground/20 hover:text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity z-20 relative" 
          onClick={(e) => e.stopPropagation()} 
        >
          <GripVertical className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 text-left flex items-start gap-2 pointer-events-none">
          <Folder className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isActive ? "text-accent" : "text-foreground/50"}`} />
          <span>
            <span className="block text-sm font-bold text-foreground">{folder.name}</span>
            {folderViewMode === "full" && folder.description ? <span className="mt-1 block line-clamp-2 text-xs text-foreground/48">{folder.description}</span> : null}
          </span>
        </div>
      </button>
    </div>
  );
}

export function Sidebar({ copy, currentView, folders, folderViewMode, activeFolderId, isDesktop = false, invitesCount = 0, onClose, onCreateFolder, onOpenFolder, onOpenSheet, onSwitchView }: SidebarProps) {
  const logoClicksRef = useRef(0);
  const developerMode = useUiStore((s) => s.developerMode);
  const toggleDeveloperMode = useUiStore((s) => s.toggleDeveloperMode);
  const user = useAuthStore((s) => s.user);

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

  return (
    <aside className="sidebar-glass panel-card flex h-full flex-col overflow-hidden p-4 shadow-2xl shadow-violet-950/10">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
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
        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          <nav className="mt-0 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.view;

              return (
                <button className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${isActive ? "border-accent bg-accent/15 text-accent ring-1 ring-accent/50" : "border-transparent text-foreground/70 hover:border-border hover:bg-surface-strong"}`} key={item.key} onClick={() => onSwitchView(item.view)} type="button">
                  <span className="flex items-center gap-3">
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{copy.shell[item.key]}</span>
                  </span>
                  {item.key === "invites" && invitesCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-background animate-pulse shrink-0">
                      {invitesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <SidebarSection action={copy.shell.createFolder} className="mt-0.5" onAction={(event) => onCreateFolder(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} title={copy.shell.folders} folders={folders}>
            <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {folders.map((folder) => {
                const isActive = activeFolderId === folder.id && currentView === "folder";
                return <SortableFolderItem key={folder.id} folder={folder} isActive={isActive} folderViewMode={folderViewMode} onOpenFolder={onOpenFolder} />;
              })}
            </SortableContext>
            {developerMode && isAdminUser(user?.email) ? (
              <button className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${currentView === "admin_tools" ? "border-accent bg-accent/15 text-accent ring-1 ring-accent/50" : "border-transparent text-foreground/70 hover:border-border hover:bg-surface-strong"}`} onClick={() => onSwitchView("admin_tools")} type="button">
                <Shield className="h-[18px] w-[18px]" />
                <span>{copy.shell.adminTools}</span>
              </button>
            ) : null}
          </SidebarSection>
        </div>

      <div className="mt-3 shrink-0 border-t border-border/80 pt-3 pr-2">
        <div className="grid gap-2 rounded-[1.25rem] border border-border bg-surface-strong/55 p-2">

        <button className="flex w-full items-center justify-center rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm font-bold hover:bg-background/70" onClick={(event) => onOpenSheet("about", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button">
          {copy.shell.about}
        </button>
        <Button asChild className="min-h-10 w-full rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm font-bold shadow-none hover:bg-background/70" variant="ghost">
          <Link href="/settings">{copy.common.settings}</Link>
        </Button>
        </div>
      </div>
      </div>
    </aside>
  );
}

import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";

function SidebarSection({ title, action, children, onAction, className, folders }: { title: string; action?: string; children: React.ReactNode; onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void; className?: string; folders?: FolderEntity[] }) {
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
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/42">{title}</h2>
        {action ? <button className="text-xs font-black text-accent" onClick={onAction} type="button">{action}</button> : null}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-1">{children}</div>
      </DndContext>
    </section>
  );
}
