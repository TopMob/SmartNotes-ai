"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendPasswordReset, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail } from "@/features/auth/api/auth-client";

export function useAuthActions() {
  const router = useRouter();
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
