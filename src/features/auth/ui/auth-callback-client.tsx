"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { exchangeCodeForSession } from "@/features/auth/api/auth-client";

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next");
    const next = rawNext && rawNext.startsWith("/") ? rawNext : "/";

    if (!code) {
      setError("Missing auth code");
      return;
    }

    void exchangeCodeForSession(code)
      .then(() => {
        router.replace(next as Route);
        router.refresh();
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to complete authentication");
      });
  }, [router, searchParams]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 text-center shadow-2xl shadow-violet-950/10">
        <h1 className="text-2xl font-black">SmartNotes Auth</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-rose-500">{error}</p>
            <Link className="mt-5 inline-flex rounded-2xl bg-foreground px-4 py-3 text-sm font-bold text-background" href="/login">
              Back to login
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-foreground/60">Completing sign-in and syncing your session...</p>
        )}
      </section>
    </main>
  );
}
