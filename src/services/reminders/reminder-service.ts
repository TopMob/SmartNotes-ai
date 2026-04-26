import { publish } from "@/services/event-bus";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleReminder(noteId: string, reminderAt: string | null) {
  const existing = timers.get(noteId);

  if (existing) {
    clearTimeout(existing);
    timers.delete(noteId);
  }

  if (!reminderAt) {
    return;
  }

  const delay = new Date(reminderAt).getTime() - Date.now();

  if (delay <= 0) {
    publish("reminderTriggered", { noteId });
    return;
  }

  timers.set(
    noteId,
    setTimeout(() => publish("reminderTriggered", { noteId }), delay),
  );
}
