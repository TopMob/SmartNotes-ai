"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { DataBootstrap } from "@/features/bootstrap/ui/data-bootstrap";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { createAppQueryClient } from "@/shared/lib/react-query/query-client";
import { PwaRegister } from "./pwa-register";
import { AuthProvider } from "@/features/auth/ui/auth-provider";
import { RootErrorBoundary } from "@/shared/ui/error-boundary";

function ThemeBridge() {
  const { data: settings } = useSettingsQuery();

  useEffect(() => {
    if (!settings) {
      return;
    }

    const root = document.documentElement;

    root.lang = settings.lang;
    root.dataset.theme = settings.preset;
    root.style.setProperty("--ui-opacity", `${settings.uiOpacity}`);
    root.style.setProperty("--cards-opacity", `${settings.cardsOpacity}`);
    root.style.setProperty("--main-background-url", settings.mainBackgroundUrl ? `url(${settings.mainBackgroundUrl})` : "none");
    root.style.setProperty("--sidebar-background-url", settings.sidebarBackgroundUrl ? `url(${settings.sidebarBackgroundUrl})` : "none");
  }, [settings]);

  return null;
}

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () => createAppQueryClient(),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <AuthProvider>
          <DataBootstrap>
            <PwaRegister />
            <ThemeBridge />
            {children}
          </DataBootstrap>
        </AuthProvider>
      </RootErrorBoundary>
    </QueryClientProvider>
  );
}
