import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Same-origin path that `next.config.ts` rewrites to the real Supabase origin.
const PROXY_PREFIX = "/-/supabase";

// The proxy rewrite only exists when the Supabase origin is known at build time
// (same condition as `next.config.ts`). If it isn't, we must talk to Supabase directly.
const PROXY_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL,
);

/**
 * Reroutes direct `https://<ref>.supabase.co/...` HTTP calls to our same-origin
 * BFF proxy (`/-/supabase/...`) so they survive RU DPI throttling. WebSocket
 * (Realtime) requests are left untouched and stay direct. See `next.config.ts`.
 */
function createProxyFetch(directOrigin: string): typeof fetch {
  return (input, init) => {
    if (typeof input === "string" || input instanceof URL) {
      const href = input.toString();
      if (href.startsWith(directOrigin)) {
        return fetch(`${PROXY_PREFIX}${href.slice(directOrigin.length)}`, init);
      }
    }
    return fetch(input, init);
  };
}

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return null;
  }

  // Keep the real URL so Realtime builds a correct `wss://` endpoint, but tunnel
  // REST/Auth/Storage HTTP traffic through the same-origin proxy when available.
  const shouldProxy = PROXY_ENABLED && typeof window !== "undefined";
  const directOrigin = new URL(url).origin;

  browserClient = createBrowserClient<Database>(url, publishableKey, {
    global: shouldProxy ? { fetch: createProxyFetch(directOrigin) } : undefined,
  });
  return browserClient;
}

/** Reset the singleton - useful for tests or when config changes */
