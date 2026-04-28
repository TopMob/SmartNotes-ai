"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendPasswordReset, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail, updateCurrentProfile } from "@/features/auth/api/auth-client";
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
    loginWithEmail: async (email: string, password: string) => {
      await run(async () => {
        await signInWithEmail({ email, password });
        router.replace("/");
        router.refresh();
      });
    },
    registerWithEmail: async (email: string, password: string) => {
      await run(async () => {
        await signUpWithEmail({ email, password });
        setMessage("Проверьте почту для подтверждения регистрации.");
      });
    },
    loginWithGoogle: async () => {
      await run(async () => {
        await signInWithGoogle();
      });
    },
    updateProfile: async (payload: { displayName?: string; photoURL?: string | null }) => {
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
    },
    resetPassword: async (email: string) => {
      await run(async () => {
        await sendPasswordReset(email);
        setMessage("Ссылка для сброса пароля отправлена.");
      });
    },
    logout: async () => {
      await run(async () => {
        await signOut();
        router.replace("/login");
        router.refresh();
      });
    },
  };
}
