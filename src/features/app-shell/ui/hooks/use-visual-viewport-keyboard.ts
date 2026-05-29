"use client";

import { useEffect } from "react";

/**
 * A custom React hook that tracks the visual viewport changes (especially on iOS Safari)
 * and sets dynamic CSS custom properties `--vv-height` and `--keyboard-height` on the root.
 * Updates are throttled using requestAnimationFrame to eliminate lag and jitter.
 */
export function useVisualViewportKeyboard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let rafId: number;

    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const layoutH = window.innerHeight;
        const visualH = vv.height;
        
        // Calculate virtual keyboard height by checking layout height minus visual viewport height and any vertical scroll offset
        const keyboard = Math.max(0, layoutH - visualH - vv.offsetTop);
        
        root.style.setProperty("--keyboard-height", `${keyboard}px`);
        root.style.setProperty("--vv-height", `${visualH}px`);
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
