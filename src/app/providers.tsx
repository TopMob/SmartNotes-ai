"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { PwaRegister } from "./pwa-register";
import { useThemeStore } from "@/shared/store/theme-store";

function ThemeBridge() {
  const preset = useThemeStore((state) => state.preset);
  const lang = useThemeStore((state) => state.lang);
  const mainBackgroundUrl = useThemeStore((state) => state.mainBackgroundUrl);
  const sidebarBackgroundUrl = useThemeStore((state) => state.sidebarBackgroundUrl);
  const uiOpacity = useThemeStore((state) => state.uiOpacity);
  const cardsOpacity = useThemeStore((state) => state.cardsOpacity);

  useEffect(() => {
    const root = document.documentElement;

    root.lang = lang;
    root.dataset.theme = preset;
    root.style.setProperty("--ui-opacity", `${uiOpacity}`);
    root.style.setProperty("--cards-opacity", `${cardsOpacity}`);
    root.style.setProperty("--main-background-url", mainBackgroundUrl ? `url(${mainBackgroundUrl})` : "none");
    root.style.setProperty("--sidebar-background-url", sidebarBackgroundUrl ? `url(${sidebarBackgroundUrl})` : "none");
  }, [cardsOpacity, lang, mainBackgroundUrl, preset, sidebarBackgroundUrl, uiOpacity]);

  return null;
}

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PwaRegister />
      <ThemeBridge />
      {children}
    </QueryClientProvider>
  );
}
