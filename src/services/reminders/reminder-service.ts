import { publish } from "@/services/event-bus";
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const REMINDERS_KEY = "smartnotes:reminders";

function readReminderRegistry() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const value = window.localStorage.getItem(REMINDERS_KEY);
    return value ? (JSON.parse(value) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeReminderRegistry(registry: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(registry));
  } catch {
    return;
  }
}

function triggerReminder(noteId: string) {
  publish("reminderTriggered", { noteId });
}

export function scheduleReminder(noteId: string, reminderAt: string | null) {
  const existing = timers.get(noteId);

  if (existing) {
    clearTimeout(existing);
    timers.delete(noteId);
  }

  if (!reminderAt) {
    const registry = readReminderRegistry();
    delete registry[noteId];
    writeReminderRegistry(registry);
    return;
  }

  writeReminderRegistry({ ...readReminderRegistry(), [noteId]: reminderAt });

  const delay = new Date(reminderAt).getTime() - Date.now();

  if (delay <= 0) {
    triggerReminder(noteId);
    return;
  }

  timers.set(
    noteId,
    setTimeout(() => triggerReminder(noteId), delay),
  );
}

export function listScheduledReminders() {
  return readReminderRegistry();
}
