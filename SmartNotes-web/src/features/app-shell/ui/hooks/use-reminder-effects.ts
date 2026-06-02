"use client";
import { stripHtml } from "@/shared/utils/string";

import { useEffect } from "react";

import type { Note } from "@/entities/note";
import { requestNotificationPermission, showNotification } from "@/services/notifications/notification-service";
import { syncReminders } from "@/services/reminders/reminder-service";
import { subscribe } from "@/services/event-bus";

export function useReminderEffects(notes: Note[]) {
  useEffect(() => {
    const unsubscribe = subscribe("reminderTriggered", async ({ noteId }) => {
      const triggeredNote = notes.find((item) => item.id === noteId);

      if (!triggeredNote) {
        return;
      }

      const permission = await requestNotificationPermission();

      if (permission === "granted") {
        showNotification(triggeredNote.title || "Reminder", {
          body: stripHtml(triggeredNote.content).slice(0, 120),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [notes]);

  useEffect(() => {
    syncReminders(notes.map((note) => ({ id: note.id, reminderAt: note.reminderAt })));
  }, [notes]);
}
