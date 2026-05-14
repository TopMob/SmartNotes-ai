"use client";

import { Command, Copy, LogOut, MoreHorizontal, Pencil, Search, SlidersHorizontal, UserRound } from "lucide-react";
import type React from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
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
  profileOpen: boolean;
  profileRef: React.RefObject<HTMLDivElement | null>;
  setProfileOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export function Header({ copy, view, activeFolder, searchQuery: _searchQuery, filtersOpen, filtersRef, onOpenDrawer, onOpenFilters, onOpenFolderMenu, profileOpen, profileRef, setProfileOpen, setSearchQuery: _setSearchQuery }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const { logout, pending, updateProfile } = useAuthActions();
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

  const userName = user?.displayName?.trim() || user?.email || "Guest";
  const userUid = user?.uid ?? "anonymous";

  async function editDisplayName() {
    const nextName = window.prompt("Новое имя профиля", userName)?.trim();

    if (!nextName) {
      return;
    }

    await updateProfile({ displayName: nextName.slice(0, 80) });
  }

  async function changeAvatar() {
    const nextValue = window.prompt("URL аватара", user?.photoURL ?? "");

    if (nextValue === null) {
      return;
    }

    const nextUrl = nextValue.trim();

    await updateProfile({ photoURL: nextUrl || null });
  }

  return (
    <header className="top-bar sticky top-0 z-20 px-3 py-3 pb-[3.5rem] shadow-lg shadow-violet-950/5 sm:px-4 md:pb-3 md:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-foreground/72 lg:hidden" onClick={onOpenDrawer} type="button">
            <MoreHorizontal className="h-5 w-5" />
          </button>

          <h1 className="truncate text-xl font-black tracking-tight">{title}</h1>
          {view === "folder" ? <button className="rounded-full p-2 text-foreground/45 hover:bg-surface-strong" onClick={(event) => onOpenFolderMenu(getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-5 w-5" /></button> : null}
        </div>

        <label className="absolute left-[15px] right-[15px] top-[65px] z-50 flex h-[42px] min-w-0 max-w-none items-center gap-3 rounded-full border border-border bg-surface-strong px-4 shadow-lg md:static md:mx-auto md:flex-1 md:max-w-[560px] md:shadow-inner md:shadow-violet-950/4">
          <Search className="h-5 w-5 shrink-0 text-foreground/38" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/38" onChange={(event) => useSearchStore.getState().setQuery(event.target.value)} placeholder={copy.shell.search} value={useSearchStore((state) => state.query)} />
          <kbd className="hidden items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold text-foreground/32 md:flex" title="Command Palette">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </label>
        <div className="flex shrink-0 items-center gap-2">

          <div className="relative shrink-0" ref={filtersRef}>
            <button className={`flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-bold ${filtersOpen ? "bg-foreground text-background" : "bg-surface-strong text-foreground/72"}`} onClick={onOpenFilters} type="button">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">{copy.shell.filters}</span>
            </button>
          </div>

          <div className="relative shrink-0" ref={profileRef}>
            <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-strong" onClick={() => setProfileOpen(!profileOpen)} type="button">
              <UserRound className="h-5 w-5" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(92vw,18rem)] rounded-[1.5rem] border border-border bg-surface p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl lg:w-72">
                <div className="rounded-2xl bg-surface-strong p-3">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-black">{userName}</p>
                    <button className="rounded-full p-2 text-foreground/48 hover:bg-background" onClick={() => void editDisplayName()} type="button">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <button className="mt-2 w-full rounded-xl bg-background/70 px-3 py-2 text-left text-xs font-bold text-foreground/56" onClick={() => void changeAvatar()} type="button">
                    Сменить аватар
                  </button>
                  <button className="mt-2 flex w-full items-center justify-between rounded-xl bg-background/70 px-3 py-2 text-left text-xs font-bold text-foreground/56" onClick={() => void navigator.clipboard.writeText(userUid)} type="button">
                    UID: {userUid}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-500" disabled={pending} onClick={() => void logout()} type="button">
                  <LogOut className="h-4 w-4" />
                  {copy.shell.logout}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
