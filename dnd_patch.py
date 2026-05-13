import re

with open("src/features/app-shell/ui/components/Sidebar.tsx", "r") as f:
    content = f.read()

import_statement = """import { Archive, Bell, EyeOff, Folder, Heart, Inbox, Lock, Shield, Trash2, X, GripVertical, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { useMemo } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';"""

content = content.replace('import { Archive, Bell, EyeOff, Folder, Heart, Inbox, Lock, Shield, Trash2, X, type LucideIcon } from "lucide-react";\nimport Link from "next/link";\nimport type React from "react";', import_statement)

sortable_item = """
function SortableFolderItem({ folder, isActive, folderViewMode, onOpenFolder }: { folder: FolderEntity; isActive: boolean; folderViewMode: "compact" | "full"; onOpenFolder: (folder: FolderEntity) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group flex w-full items-start gap-2 rounded-2xl border p-3 text-left transition ${isActive ? "border-accent bg-accent/15 text-accent ring-1 ring-accent/50" : "border-transparent hover:border-border hover:bg-surface-strong"}`}>
      <div {...attributes} {...listeners} className="mt-0.5 cursor-grab touch-none text-foreground/20 hover:text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" >
        <GripVertical className="h-[18px] w-[18px]" />
      </div>
      <button className="flex-1 text-left flex items-start gap-2" onClick={() => onOpenFolder(folder)} type="button">
        <Folder className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isActive ? "text-accent" : "text-foreground/50"}`} />
        <span>
          <span className="block text-sm font-bold">{folder.name}</span>
          {folderViewMode === "full" && folder.description ? <span className="mt-1 block line-clamp-2 text-xs text-foreground/48">{folder.description}</span> : null}
        </span>
      </button>
    </div>
  );
}
"""

content = content.replace("export function Sidebar", sortable_item + "\nexport function Sidebar")

old_folders_render = """            {folders.map((folder) => {
              const isActive = activeFolderId === folder.id && currentView === "folder";

              return (
                <button className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${isActive ? "border-accent bg-accent/15 text-accent ring-1 ring-accent/50" : "border-transparent hover:border-border hover:bg-surface-strong"}`} key={folder.id} onClick={() => onOpenFolder(folder)} type="button">
                  <Folder className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isActive ? "text-accent" : "text-foreground/50"}`} />
                  <span>
                    <span className="block text-sm font-bold">{folder.name}</span>
                    {folderViewMode === "full" && folder.description ? <span className="mt-1 block line-clamp-2 text-xs text-foreground/48">{folder.description}</span> : null}
                  </span>
                </button>
              );
            })}"""

new_folders_render = """            <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {folders.map((folder) => {
                const isActive = activeFolderId === folder.id && currentView === "folder";
                return <SortableFolderItem key={folder.id} folder={folder} isActive={isActive} folderViewMode={folderViewMode} onOpenFolder={onOpenFolder} />;
              })}
            </SortableContext>"""

content = content.replace(old_folders_render, new_folders_render)

old_sidebar_section = """          <SidebarSection action={copy.shell.createFolder} className="mt-0.5" onAction={(event) => onCreateFolder(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} title={copy.shell.folders}>"""

new_sidebar_section = """          <SidebarSection action={copy.shell.createFolder} className="mt-0.5" onAction={(event) => onCreateFolder(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} title={copy.shell.folders} folders={folders}>"""

content = content.replace(old_sidebar_section, new_sidebar_section)

old_sidebar_section_decl = """function SidebarSection({ title, action, children, onAction, className }: { title: string; action?: string; children: React.ReactNode; onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void; className?: string }) {
  return (
    <section className={className ?? "mt-0"}>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/42">{title}</h2>
        {action ? <button className="text-xs font-black text-accent" onClick={onAction} type="button">{action}</button> : null}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}"""

new_sidebar_section_decl = """import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";

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
}"""

content = content.replace(old_sidebar_section_decl, new_sidebar_section_decl)

with open("src/features/app-shell/ui/components/Sidebar.tsx", "w") as f:
    f.write(content)
