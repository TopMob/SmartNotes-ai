"use client";

import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { bootstrapProfile } from "@/features/auth/api/profile-bootstrap";
import { fetchAuthRuntimeConfig } from "@/features/auth/api/runtime-config";
import { clearGuestSession, readGuestSession } from "@/features/auth/lib/guest-session";
import { initGoogleOneTap } from "@/features/auth/lib/google-one-tap";
import { signInWithGoogleIdToken } from "@/features/auth/api/auth-client";
import { mapAuthUser } from "@/features/auth/lib/map-auth-user";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

const AUTH_BOOT_TIMEOUT_MS = 8_000;

function createLocalModeUser() {
  return {
    id: "local-user",
    uid: "local-user",
    email: "local@smartnotes.app",
    displayName: "Local User",
    photoURL: null,
  };
}

function activateGuestSession(runtimeConfig: Awaited<ReturnType<typeof fetchAuthRuntimeConfig>>) {
  const session = readGuestSession();

  if (!session) {
    return false;
  }

  useAuthStore.getState().setAuthState({
    status: "authenticated",
    user: session.user,
    degraded: true,
    error: "Гостевой режим: данные будут удалены через 10 минут.",
  });
  useAuthStore.getState().setRuntimeConfig(runtimeConfig);
  return true;
}

async function syncSession(session: Session | null) {
  const store = useAuthStore.getState();

  if (!session?.user) {
    store.setAuthState({ status: "anonymous", user: null });
    return;
  }

  const supabase = createSupabaseBrowserClient();

   if (!supabase) {
    store.setAuthState({ status: "degraded", user: null, degraded: true, error: "Supabase client is unavailable in this environment" });
    return;
  }

  await bootstrapProfile(supabase, session.user);
  store.setAuthState({ status: "authenticated", user: mapAuthUser(session.user) });
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let guestExpiryId: number | undefined;
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


        if (runtimeConfig.googleClientId) {
          let meta = document.querySelector<HTMLMetaElement>("meta[name=google-client-id]");
          if (!meta) {
            meta = document.createElement("meta");
            meta.name = "google-client-id";
            document.head.appendChild(meta);
          }
          meta.content = runtimeConfig.googleClientId;
        }

        if (activateGuestSession(runtimeConfig)) {
          const session = readGuestSession();

          if (session) {
            guestExpiryId = window.setTimeout(() => {
              clearGuestSession(session.user.id);
              useAuthStore.getState().setAuthState({ status: "anonymous", user: null });
            }, Math.max(0, session.expiresAt - Date.now()));
          }

          setReady(true);
          return;
        }

        if (!runtimeConfig.url || !runtimeConfig.publishableKey) {
          useAuthStore.getState().setAuthState({
            status: "authenticated",
            user: createLocalModeUser(),
            degraded: true,
            error: "Supabase runtime config is incomplete. Running in local mode.",
          });
          setReady(true);
          return;
        }

        const supabase = createSupabaseBrowserClient();

        if (!supabase) {
          useAuthStore.getState().setAuthState({
            status: "authenticated",
            user: createLocalModeUser(),
            degraded: true,
            error: "Supabase browser client is unavailable. Running in local mode.",
          });
          setReady(true);
          return;
        }

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

          const isLoginPage = typeof window !== "undefined" && window.location.pathname.startsWith("/login");
          if (!sessionData.session && runtimeConfig.googleClientId && !isLoginPage) {
            void initGoogleOneTap(runtimeConfig.googleClientId, async (credential) => {
              await signInWithGoogleIdToken(credential);
            });
          }
        }

        return () => authListener.data.subscription.unsubscribe();
      } catch (error) {
        useAuthStore.getState().setAuthState({
          status: "authenticated",
          user: createLocalModeUser(),
          degraded: true,
          error: error instanceof Error ? `${error.message}. Running in local mode.` : "Failed to bootstrap auth. Running in local mode.",
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
      if (guestExpiryId !== undefined) {
        window.clearTimeout(guestExpiryId);
      }
      cleanup?.();
    };
  }, []);

  if (!ready) {
    return null;
  }

  return children;
}
