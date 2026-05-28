"use client";

import { Command, Menu, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import type React from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView } from "@/shared/store/ui-store";
import { useSearchStore } from "@/features/search";

import { getSheetAnchor, type SheetAnchor } from "./shared";

type HeaderProps = {
  copy: ReturnType<typeof getUiCopy>;
  view: AppView;
  activeFolder: FolderEntity | null;
  searchQuery: string;
  filtersOpen: boolean;
  filtersRef: React.RefObject<HTMLDivElement | null>;
  onOpenDrawer: () => void;
  onOpenFilters: () => void;
  onOpenFolderMenu: (anchor: SheetAnchor) => void;
  setSearchQuery: (query: string) => void;
};

export function Header({
  copy,
  view,
  activeFolder,
  searchQuery: _searchQuery,
  filtersOpen,
  filtersRef,
  onOpenDrawer,
  onOpenFilters,
  onOpenFolderMenu,
  setSearchQuery: _setSearchQuery,
}: HeaderProps) {
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
    <header className="top-bar sticky top-0 z-20 px-3 py-3 pb-[4rem] shadow-lg shadow-violet-950/5 sm:px-4 md:pb-3 md:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-foreground/72 sm:h-10 sm:w-10 lg:hidden"
            onClick={onOpenDrawer}
            type="button"
            aria-label="Открыть меню"
          >
            <Menu className="h-6 w-6 sm:h-5 sm:w-5" />
          </button>

          <h1 className="truncate text-xl font-black tracking-tight">{title}</h1>
          {view === "folder" ? (
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/45 hover:bg-surface-strong sm:h-10 sm:w-10"
              onClick={(event) => onOpenFolderMenu(getSheetAnchor(event.currentTarget.getBoundingClientRect()))}
              type="button"
            >
              <MoreHorizontal className="h-6 w-6 sm:h-5 sm:w-5" />
            </button>
          ) : null}
        </div>

        <label className="absolute left-[15px] right-[15px] top-[4.5rem] z-50 flex h-11 min-w-0 max-w-none items-center gap-3 rounded-full border border-border bg-surface-strong px-4 shadow-lg md:static md:mx-auto md:flex-1 md:h-10 md:max-w-[560px] md:shadow-inner md:shadow-violet-950/4">
          <Search className="h-5 w-5 shrink-0 text-foreground/38" />
          <input
            type="search"
            autoComplete="off"
            name="search_query_input"
            id="search_query_input"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/38"
            onChange={(event) => useSearchStore.getState().setQuery(event.target.value)}
            placeholder={copy.shell.search}
            value={useSearchStore((state) => state.query)}
          />
          <kbd
            className="hidden items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold text-foreground/32 md:flex"
            title="Command Palette"
          >
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </label>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative shrink-0" ref={filtersRef}>
            <button
              className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-bold sm:h-10 ${
                filtersOpen ? "bg-foreground text-background" : "bg-surface-strong text-foreground/72"
              }`}
              onClick={onOpenFilters}
              type="button"
            >
              <SlidersHorizontal className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{copy.shell.filters}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
