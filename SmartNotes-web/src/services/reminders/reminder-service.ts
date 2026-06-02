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

/**
 * Sync reminders with a full note list. Only updates timers for notes
 * whose reminderAt has changed or been added/removed.
 */
export function syncReminders(notes: Array<{ id: string; reminderAt: string | null }>) {
  const registry = readReminderRegistry();
  const noteMap = new Map(notes.map((note) => [note.id, note.reminderAt]));


  for (const [noteId, cachedAt] of Object.entries(registry)) {
    const currentReminderAt = noteMap.get(noteId);

    if (currentReminderAt === undefined || currentReminderAt === null) {

      const existing = timers.get(noteId);
      if (existing) {
        clearTimeout(existing);
        timers.delete(noteId);
      }
      delete registry[noteId];
    } else if (currentReminderAt !== cachedAt) {

      scheduleReminder(noteId, currentReminderAt);
    }

  }


  for (const [noteId, reminderAt] of noteMap.entries()) {
    if (reminderAt !== null && !(noteId in registry)) {
      scheduleReminder(noteId, reminderAt);
    }
  }

  writeReminderRegistry(registry);
}

