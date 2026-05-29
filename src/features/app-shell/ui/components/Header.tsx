"use client";

import { Command, Menu, MoreHorizontal, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import React, { useState, useEffect } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import { getUiCopy } from "@/shared/lib/i18n";
import { type AppView } from "@/shared/store/ui-store";

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
  aiChatOpen?: boolean;
  onToggleAiChat?: () => void;
};

export const Header = React.memo(function Header({
  copy,
  view,
  activeFolder,
  searchQuery,
  filtersOpen,
  filtersRef,
  onOpenDrawer,
  onOpenFilters,
  onOpenFolderMenu,
  setSearchQuery,
  aiChatOpen = false,
  onToggleAiChat,
}: HeaderProps) {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(navigator.userAgent.indexOf("Mac") !== -1);
    }
  }, []);
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
    <header className="top-bar sticky top-0 z-20 px-3 py-3 shadow-lg shadow-violet-950/5 sm:px-4 md:py-3">
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

          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-foreground/72 sm:h-10 sm:w-10 md:hidden"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            type="button"
            aria-label="Поиск"
          >
            <Search className="h-6 w-6 sm:h-5 sm:w-5" />
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

        <div className="hidden md:flex md:static md:mx-auto md:flex-1 md:h-10 md:max-w-[560px] md:shadow-inner md:shadow-violet-950/4 items-center gap-3 rounded-full border border-border bg-surface-strong px-4 focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all duration-200">
          <Search className="h-5 w-5 shrink-0 text-foreground/38" />
          <input
            type="search"
            autoComplete="off"
            name="note_search_field"
            id="note_search_field"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/38"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.shell.search}
            value={searchQuery}
          />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            className="hidden items-center gap-1 rounded-lg border border-border bg-surface hover:bg-surface-strong px-2 py-0.5 text-[10px] font-black text-foreground/45 md:flex transition cursor-pointer"
            title={copy.shell.search || "Поиск..."}
            type="button"
          >
            {isMac ? (
              <>
                <Command className="h-2.5 w-2.5 text-foreground/32" />K
              </>
            ) : (
              "Ctrl K"
            )}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Glowing AI Chat Button */}
          <button
            className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-bold sm:h-10 transition-all duration-300 ${
              aiChatOpen
                ? "bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                : "bg-surface-strong border-border text-foreground/72 hover:border-violet-500 hover:text-violet-600"
            }`}
            onClick={onToggleAiChat}
            type="button"
            title="AI Чат"
          >
            <Sparkles className={`h-5 w-5 sm:h-4 sm:w-4 ${aiChatOpen ? "fill-white" : ""}`} />
            <span className="hidden sm:inline">AI Чат</span>
          </button>

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
});
