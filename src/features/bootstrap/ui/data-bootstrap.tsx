"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { startSyncConsumer } from "@/services/sync/sync-consumer";
import { startRealtimeSubscriptions, stopRealtimeSubscriptions } from "@/services/realtime/realtime-subscriptions";

export function DataBootstrap({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const resetNoteUi = useNoteUiStore((state) => state.reset);

  useEffect(() => {
    if (authStatus !== "anonymous") {
      return;
    }

    resetNoteUi();
    void queryClient.clear();
  }, [authStatus, queryClient, resetNoteUi]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      startSyncConsumer();
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      startRealtimeSubscriptions(queryClient);
      return () => stopRealtimeSubscriptions();
    }
  }, [authStatus, queryClient]);

  return children;
}
