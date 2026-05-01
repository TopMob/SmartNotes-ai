"use client";

// ---------------------------------------------------------------------------
// Google One Tap — GSI SDK integration
// Spec: SmartNotes_Features.txt §1 AUTH И SESSION
// ---------------------------------------------------------------------------

const ONE_TAP_COOLDOWN_KEY = "sn_one_tap_last_shown";
const ONE_TAP_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between prompts
const GSI_SCRIPT_ID = "google-gsi-script";
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export type OneTapCredentialCallback = (credential: string) => Promise<void>;

/** Returns true if enough time has passed since the last One Tap prompt */
function isOneTapCooldownExpired(): boolean {
  try {
    const last = localStorage.getItem(ONE_TAP_COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > ONE_TAP_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markOneTapShown() {
  try {
    localStorage.setItem(ONE_TAP_COOLDOWN_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

/** Dynamically load the GSI script if it isn't already present */
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(GSI_SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = GSI_SCRIPT_ID;
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google GSI script."));
    document.head.appendChild(script);
  });
}

/** Initialize Google One Tap. Resolves when the prompt is shown or skipped. */
export async function initGoogleOneTap(
  clientId: string,
  onCredential: OneTapCredentialCallback,
): Promise<() => void> {
  if (!clientId) {
    return () => undefined;
  }

  if (!isOneTapCooldownExpired()) {
    return () => undefined;
  }

  try {
    await loadGsiScript();
  } catch {
    // GSI unavailable (e.g. blocked by browser/extension) — degrade silently
    return () => undefined;
  }

  const google = (window as unknown as { google?: { accounts: { id: { initialize: (c: object) => void; prompt: (cb?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void) => void; cancel: () => void } } } }).google;

  if (!google?.accounts?.id) {
    return () => undefined;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response: { credential: string }) => {
      try {
        await onCredential(response.credential);
      } catch {
        // credential exchange failed — user can still log in manually
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    context: "signin",
  });

  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // One Tap was blocked or dismissed — mark cooldown so we don't spam
      markOneTapShown();
    } else {
      markOneTapShown();
    }
  });

  return () => {
    try {
      google.accounts.id.cancel();
    } catch {
      // ignore cleanup errors
    }
  };
}
