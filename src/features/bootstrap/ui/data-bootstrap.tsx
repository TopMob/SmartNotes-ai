"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { isGuestUser } from "@/features/auth/lib/guest-session";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { startSyncConsumer } from "@/services/sync/sync-consumer";
import { startRealtimeSubscriptions, stopRealtimeSubscriptions } from "@/services/realtime/realtime-subscriptions";
import { subscribe } from "@/services/event-bus";
import { submitFeedback } from "@/features/feedback/api/feedback-api";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { startBackgroundAiScheduler, scheduleAiAnalysis, listPendingAiAnalysis } from "@/services/ai/ai-queue";

export function DataBootstrap({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const authDegraded = useAuthStore((state) => state.degraded);
  const resetNoteUi = useNoteUiStore((state) => state.reset);
  const hasRemoteUser = authUser !== null && authUser.id !== "local-user" && !isGuestUser(authUser);
  const canUseRemoteSync = authStatus === "authenticated" && !authDegraded && hasRemoteUser;

  const { data: notes = [] } = useNotesFlat();

  useEffect(() => {
    if (authStatus !== "anonymous") {
      return;
    }

    resetNoteUi();
    void queryClient.clear();
  }, [authStatus, queryClient, resetNoteUi]);

  useEffect(() => {
    if (canUseRemoteSync) {
      startSyncConsumer();
    }

    return undefined;
  }, [canUseRemoteSync]);

  useEffect(() => {
    if (canUseRemoteSync) {
      startRealtimeSubscriptions(queryClient);
      return () => stopRealtimeSubscriptions();
    }

    stopRealtimeSubscriptions();
    return undefined;
  }, [canUseRemoteSync, queryClient]);

  useEffect(() => {
    startBackgroundAiScheduler();
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && notes.length > 0) {
      const pendingIds = listPendingAiAnalysis();
      const unanalyzedNotes = notes.filter(
        (note) =>
          !note.trashedAt &&
          note.analyzed === false &&
          (note.aiStatus === "pending" ? !pendingIds.includes(note.id) : (
            note.aiStatus !== "analyzing" &&
            note.aiStatus !== "error"
          ))
      );

      if (unanalyzedNotes.length > 0) {
        unanalyzedNotes.forEach((note) => {
          scheduleAiAnalysis(note.id);
        });
      }
    }
  }, [notes, authStatus]);

  // Invalidate notes cache when background processes or synchronization completes
  useEffect(() => {
    const unsubscribeSync = subscribe("syncCompleted", () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "notes",
      });
    });

    const unsubscribeFeedback = subscribe("feedbackSubmitted", async (payload) => {
      try {
        await submitFeedback(payload);
      } catch (error) {
        console.error("Failed to submit feedback:", error);
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeFeedback();
    };
  }, [queryClient]);

  return children;
}

