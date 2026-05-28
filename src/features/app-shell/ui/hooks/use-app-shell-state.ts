"use client";

import { useEffect, useRef, useState } from "react";

import { useUiStore } from "@/shared/store/ui-store";

import type { SheetAnchor, SheetName, SheetState } from "../components/shared";

export function useAppShellState() {
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
  const setDesktopSidebarOpen = useUiStore((state) => state.setDesktopSidebarOpen);

  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const filtersPopupRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }

      if (
        !filtersRef.current?.contains(event.target as Node) &&
        !filtersPopupRef.current?.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openSheet(name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) {
    setSheet({ name, anchor: anchor ?? null });
  }

  return {
    profileOpen,
    setProfileOpen,
    profileRef,
    sheet,
    setSheet,
    openSheet,
    filtersOpen,
    setFiltersOpen,
    filtersRef,
    filtersPopupRef,
    editorOpen,
    setEditorOpen,
    toolbarVisible,
    setToolbarVisible,
    isDesktop,
  };
}
