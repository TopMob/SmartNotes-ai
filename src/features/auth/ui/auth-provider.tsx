"use client";

import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { bootstrapProfile } from "@/features/auth/api/profile-bootstrap";
import { fetchAuthRuntimeConfig } from "@/features/auth/api/runtime-config";
import { mapAuthUser } from "@/features/auth/lib/map-auth-user";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

const AUTH_BOOT_TIMEOUT_MS = 8_000;

async function syncSession(session: Session | null) {
  const store = useAuthStore.getState();

  if (!session?.user) {
    store.setAuthState({ status: "anonymous", user: null });
    return;
  }

  const supabase = createSupabaseBrowserClient();
  await bootstrapProfile(supabase, session.user);
  store.setAuthState({ status: "authenticated", user: mapAuthUser(session.user) });
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      useAuthStore.getState().setAuthState({
        status: "degraded",
        user: null,
        degraded: true,
        error: "Auth bootstrap watchdog timeout exceeded",
      });
      setReady(true);
    }, AUTH_BOOT_TIMEOUT_MS);

    let unsubscribed = false;

    async function boot() {
      try {
        const runtimeConfig = await fetchAuthRuntimeConfig(controller.signal);
        useAuthStore.getState().setRuntimeConfig(runtimeConfig);

        if (!runtimeConfig.url || !runtimeConfig.publishableKey) {
          useAuthStore.getState().setAuthState({
            status: "degraded",
            user: null,
            degraded: true,
            error: "Supabase runtime config is incomplete",
          });
          setReady(true);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const [{ data: sessionData }, authListener] = await Promise.all([
          supabase.auth.getSession(),
          Promise.resolve(
            supabase.auth.onAuthStateChange((_event, session) => {
              void syncSession(session).catch((error) => {
                useAuthStore.getState().setAuthState({
                  status: "degraded",
                  user: null,
                  degraded: true,
                  error: error instanceof Error ? error.message : "Failed to sync auth state",
                });
              });
            }),
          ),
        ]);

        if (!unsubscribed) {
          await syncSession(sessionData.session);
          setReady(true);
        }

        return () => authListener.data.subscription.unsubscribe();
      } catch (error) {
        useAuthStore.getState().setAuthState({
          status: "degraded",
          user: null,
          degraded: true,
          error: error instanceof Error ? error.message : "Failed to bootstrap auth",
        });
        setReady(true);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    let cleanup: (() => void) | undefined;

    void boot().then((value) => {
      cleanup = value;
    });

    return () => {
      unsubscribed = true;
      controller.abort();
      window.clearTimeout(timeoutId);
      cleanup?.();
    };
  }, []);

  if (!ready) {
    return null;
  }

  return children;
}
