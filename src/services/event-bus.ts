type EventMap = {
  reminderTriggered: { noteId: string };
  syncQueued: { entity: "note" | "folder" | "settings"; id: string };
  syncCompleted: { processedCount: number; failedCount: number };
  syncFailed: { message: string };
  feedbackSubmitted: { rating: number; feedback: string; diagnostics: unknown[]; systemLanguage: string; userAgent: string };
  noteImported: { noteId: string; title: string };
  toast: { id?: string; message: string; tone?: "info" | "success" | "warning" | "error" };
};

type EventName = keyof EventMap;
type EventHandler<TEventName extends EventName> = (payload: EventMap[TEventName]) => void;

const listeners = new Map<EventName, Set<(payload: EventMap[EventName]) => void>>();

export function subscribe<TEventName extends EventName>(eventName: TEventName, handler: EventHandler<TEventName>) {
  const eventListeners = listeners.get(eventName) ?? new Set();

  eventListeners.add(handler as (payload: EventMap[EventName]) => void);
  listeners.set(eventName, eventListeners);

  return () => eventListeners.delete(handler as (payload: EventMap[EventName]) => void);
}

export function publish<TEventName extends EventName>(eventName: TEventName, payload: EventMap[TEventName]) {
  listeners.get(eventName)?.forEach((handler) => handler(payload));
}
