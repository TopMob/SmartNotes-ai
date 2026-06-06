"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { useUiStore } from "@/shared/store/ui-store";

import type { SheetAnchor, SheetName, SheetState } from "../components/shared";

export function useAppShellState() {
  const desktopSidebarOpen = useUiStore((state) => state.desktopSidebarOpen);
  const desktopSidebarPinned = useUiStore((state) => state.desktopSidebarPinned);
  const setDesktopSidebarOpen = useUiStore((state) => state.setDesktopSidebarOpen);

  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sheetHistory, setSheetHistory] = useState<SheetState[]>([]);
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

      if (!desktop && desktopSidebarOpen) {
        setDesktopSidebarOpen(false);
      }

      if (desktopSidebarPinned && desktop && !desktopSidebarOpen) {
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

  const openSheet = useCallback((name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => {
    setSheet((current) => {
      if (current && current.name !== name) {
        setSheetHistory((prev) => [...prev, current]);
      }
      return { name, anchor: anchor ?? null };
    });
  }, []);

  const goBackSheet = useCallback(() => {
    setSheetHistory((prev) => {
      if (prev.length === 0) {
        setSheet(null);
        return [];
      }
      const last = prev[prev.length - 1];
      setSheet(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleSetSheet = useCallback((newSheet: SheetState | ((prev: SheetState) => SheetState)) => {
    setSheet((current) => {
      const resolved = typeof newSheet === "function" ? newSheet(current) : newSheet;
      if (resolved === null) {
        setSheetHistory([]);
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handlePopState(event: PopStateEvent) {
      if (sheet) {
        event.preventDefault();
        if (sheetHistory.length > 0) {
          goBackSheet();
          window.history.pushState({ sheetOpen: true }, "");
        } else {
          setSheet(null);
          setSheetHistory([]);
        }
      }
    }

    if (sheet) {
      if (!window.history.state?.sheetOpen) {
        window.history.pushState({ sheetOpen: true }, "");
      }
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [sheet, sheetHistory, goBackSheet]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!sheet && window.history.state?.sheetOpen) {
      window.history.back();
    }
  }, [sheet]);

  return {
    profileOpen,
    setProfileOpen,
    profileRef,
    sheet,
    setSheet: handleSetSheet,
    sheetHistory,
    openSheet,
    goBackSheet,
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
