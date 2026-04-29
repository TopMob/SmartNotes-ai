import type { User } from "@/entities/user";

const GUEST_SESSION_KEY = "smartnotes:guest:session";
export const GUEST_TTL_MS = 10 * 60 * 1000;

type GuestSession = {
  user: User;
  expiresAt: number;
};

function safeLocalStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function createGuestUser(): User {
  const id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    uid: id,
    email: null,
    displayName: "Гость",
    photoURL: null,
  };
}

export function isGuestUser(user: User | null | undefined) {
  return Boolean(user?.id.startsWith("guest_"));
}

export function beginGuestSession() {
  const storage = safeLocalStorage();
  const session: GuestSession = {
    user: createGuestUser(),
    expiresAt: Date.now() + GUEST_TTL_MS,
  };

  storage?.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function readGuestSession() {
  const storage = safeLocalStorage();
  const raw = storage?.getItem(GUEST_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as GuestSession;

    if (!session.user?.id || !session.expiresAt || session.expiresAt <= Date.now()) {
      clearGuestSession(session.user?.id);
      return null;
    }

    return session;
  } catch {
    clearGuestSession();
    return null;
  }
}

export function clearGuestSession(userId?: string) {
  const storage = safeLocalStorage();

  if (!storage) {
    return;
  }

  const activeSession = readGuestSessionWithoutCleanup();
  const targetUserId = userId ?? activeSession?.user.id;

  storage.removeItem(GUEST_SESSION_KEY);

  if (!targetUserId) {
    return;
  }

  storage.removeItem(`smartnotes:local:notes:${targetUserId}`);
  storage.removeItem(`smartnotes:local:folders:${targetUserId}`);
  storage.removeItem(`smartnotes:local:settings:${targetUserId}`);
  storage.removeItem("smartnotes:ai:pending");
  storage.removeItem("smartnotes:sync:queue");
  storage.removeItem("smartnotes:reminders");
}

function readGuestSessionWithoutCleanup() {
  const storage = safeLocalStorage();
  const raw = storage?.getItem(GUEST_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}
