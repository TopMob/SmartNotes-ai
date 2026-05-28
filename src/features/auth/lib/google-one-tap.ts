"use client";

const GSI_SCRIPT_ID = "google-gsi-script";
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export type OneTapCredentialCallback = (credential: string) => Promise<void>;

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

export async function initGoogleOneTap(
  clientId: string,
  onCredential: OneTapCredentialCallback,
): Promise<() => void> {
  if (!clientId) {
    return () => undefined;
  }

  try {
    await loadGsiScript();
  } catch {
    return () => undefined;
  }

  const google = (window as unknown as { google?: { accounts: { id: { initialize: (c: object) => void; prompt: (cb?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean; isDismissedMoment(): boolean }) => void) => void; cancel: () => void } } } }).google;

  if (!google?.accounts?.id) {
    return () => undefined;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response: { credential: string }) => {
      try {
        await onCredential(response.credential);
      } catch { }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    context: "signin",
    use_fedcm_for_prompt: true,
  });

  google.accounts.id.prompt((notification) => {
    if (notification.isDismissedMoment() || notification.isSkippedMoment()) {
      localStorage.setItem("google_onetap_dismissed_at", String(Date.now()));
    }
  });

  return () => {
    try {
      google.accounts.id.cancel();
    } catch { }
  };
}