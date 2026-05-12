"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { SmartNotesShell } from "@/features/app-shell/ui/smart-notes-shell";
import { LogoMark } from "@/shared/ui/logo-mark";
import { ShellErrorBoundary } from "@/shared/ui/error-boundary";

export function AppEntry() {
  const status = useAuthStore((s) => s.status);
  const initialized = useAuthStore((s) => s.initialized);
  const router = useRouter();

  useEffect(() => {
    if (initialized && status === "anonymous") {
      router.replace("/login");
    }
  }, [initialized, status, router]);


  if (!initialized) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <section className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-accent text-accent-foreground shadow-2xl shadow-violet-950/18">
            <LogoMark className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">SmartNotes</h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-foreground/48">AI-organized thinking</p>
          <Loader2 className="mx-auto mt-8 h-8 w-8 animate-spin text-accent" />
        </section>
      </main>
    );
  }


  if (status === "authenticated" || status === "degraded") {
    return (
      <ShellErrorBoundary>
        <SmartNotesShell />
      </ShellErrorBoundary>
    );
  }


  return null;
}
