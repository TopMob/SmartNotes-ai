"use client";

import { useEffect } from "react";
import { useLockStore } from "../model/lock-store";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function LockManager() {
  const pingActivity = useLockStore((s) => s.pingActivity);

  useEffect(() => {
    const handleActivity = () => {
      pingActivity();
    };

    // Throttle activity pings to avoid excessive state updates
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          handleActivity();
          throttleTimer = null;
        }, 1000);
      }
    };

    window.addEventListener("mousemove", throttledActivity);
    window.addEventListener("keydown", throttledActivity);
    window.addEventListener("click", throttledActivity);

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      window.removeEventListener("mousemove", throttledActivity);
      window.removeEventListener("keydown", throttledActivity);
      window.removeEventListener("click", throttledActivity);
    };
  }, [pingActivity]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - useLockStore.getState().lastActivity > LOCK_TIMEOUT_MS) {
        const hasUnlockedNotes = useLockStore.getState().unlockedNotes.size > 0;
        if (hasUnlockedNotes) {
          useLockStore.getState().lockAll();
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return null;
}