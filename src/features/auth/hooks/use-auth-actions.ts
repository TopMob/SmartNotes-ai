"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { sendPasswordReset, signInWithEmail, signInWithGoogle, signInWithGoogleIdToken, signOut, signUpWithEmail, updateCurrentProfile } from "@/features/auth/api/auth-client";
import { beginGuestSession, clearGuestSession } from "@/features/auth/lib/guest-session";
import { useAuthStore } from "@/features/auth/model/auth-store";

export function useAuthActions() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setAuthState = useAuthStore((state) => state.setAuthState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);

    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Auth request failed");
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    message,
    clearMessage: () => setMessage(null),
    loginWithEmail: useCallback(async (email: string, password: string) => {
      await run(async () => {
        await signInWithEmail({ email, password });
        router.replace("/");
        router.refresh();
      });
    }, [router]),
    registerWithEmail: useCallback(async (email: string, password: string) => {
      await run(async () => {
        await signUpWithEmail({ email, password });
        setMessage("Проверьте почту для подтверждения регистрации.");
      });
    }, []),
    loginWithGoogle: useCallback(async () => {
      await run(async () => {
        await signInWithGoogle();
      });
    }, []),
    loginWithGoogleOneTap: useCallback(async (credential: string) => {
      await run(async () => {
        await signInWithGoogleIdToken(credential);
        router.replace("/");
        router.refresh();
      });
    }, [router]),
    loginAsGuest: useCallback(async () => {
      clearGuestSession();
      const session = beginGuestSession();
      setAuthState({
        status: "authenticated",
        user: session.user,
        degraded: true,
        error: "Гостевой режим: данные будут удалены через 10 минут.",
      });
      router.replace("/");
      router.refresh();
    }, [router, setAuthState]),
    updateProfile: useCallback(async (payload: { displayName?: string; photoURL?: string | null }) => {
      await run(async () => {
        const remoteUpdated = await updateCurrentProfile(payload);

        if (user) {
          setAuthState({
            status: "authenticated",
            user: {
              ...user,
              displayName: payload.displayName === undefined ? user.displayName : payload.displayName,
              photoURL: payload.photoURL === undefined ? user.photoURL : payload.photoURL,
            },
            degraded: !remoteUpdated,
            error: remoteUpdated ? null : "Профиль обновлен локально: Supabase runtime config не задан.",
          });
        }
      });
    }, [setAuthState, user]),
    resetPassword: useCallback(async (email: string) => {
      await run(async () => {
        await sendPasswordReset(email);
        setMessage("Ссылка для сброса пароля отправлена.");
      });
    }, []),
    logout: useCallback(async () => {
      await run(async () => {
        clearGuestSession(user?.id);
        await signOut();
        router.replace("/login");
        router.refresh();
      });
    }, [router, user?.id]),
  };
}
