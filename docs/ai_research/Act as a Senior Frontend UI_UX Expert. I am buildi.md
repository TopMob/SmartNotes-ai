<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Senior Frontend UI/UX Expert. I am building a responsive note-taking PWA using Next.js 15, Tailwind CSS, and Tiptap editor. I am facing severe UI/UX issues on mobile devices, especially on iOS Safari.

Please provide a comprehensive architectural solution for the following exact problems:

1. The iOS Virtual Keyboard Issue (Visual Viewport): When the user focuses on the Tiptap editor, the virtual keyboard pops up and covers the bottom action bar (which contains tags and the save button) and sometimes overlaps the text input area making it unclickable. How do I properly use `dvh` (dynamic viewport height), `interactive-widget=resizes-content` in the meta viewport, or the Visual Viewport API to ensure the editor and bottom fixed elements resize correctly when the keyboard appears?
2. Toolbar Responsiveness: The rich text toolbar (Bold, Italic, lists, etc.) looks great on Desktop but squishes awkwardly or wraps poorly on mobile screens. What are the best UX patterns for mobile rich-text toolbars? (e.g., horizontally scrollable toolbars, sticky positioning above the keyboard, or grouped dropdowns).
3. Touch Targets \& Safe Areas: How do I properly implement iOS `safe-area-inset-bottom` and adjust touch targets (minimum 44px) so that buttons are easily clickable on mobile without looking absurdly huge on Desktop?

Output a detailed guide with Tailwind CSS patterns, Next.js metadata configurations, and React hooks (if necessary for Visual Viewport) that I can feed to an AI coding agent to fix my layout.

Use a layered approach: let modern browsers resize the layout when the keyboard opens, then add a Visual Viewport fallback for iOS Safari, and design the editor chrome as a mobile-first overflow system rather than a desktop toolbar squeezed into a phone width. For safe areas and touch targets, reserve bottom space with `env(safe-area-inset-bottom)` and keep every interactive control at a 44px minimum hit area without forcing the visual button itself to look oversized.[^1][^2][^3][^4]

## Keyboard-safe layout

The core idea is that `dvh` helps with the visible viewport, but iOS Safari still has keyboard overlap quirks, while `interactive-widget=resizes-content` tells supported browsers to resize the layout viewport when the virtual keyboard appears. Chrome documents the three resize modes, and Safari support remains inconsistent, so you need a CSS-first solution with JS fallback instead of relying on one mechanism alone.[^5][^2][^1]

### Recommended hierarchy

1. Use `viewport-fit=cover` so your app can control safe areas explicitly. `safe-area-inset-*` values are intended to be used as padding for devices with notches or home indicators.[^6][^4]
2. Set your main app shell to `min-h-dvh` or `h-dvh` so the shell tracks the dynamic viewport. `dvh` is useful for modern mobile browsers, but it does not fully solve keyboard behavior by itself on all platforms.[^7][^8]
3. Add `interactive-widget=resizes-content` in the viewport meta config for browsers that support it. This is the cleanest native signal for keyboard-aware resizing.[^2][^1]
4. For iOS Safari, use `window.visualViewport` to compute the keyboard delta and push the bottom bar above it. Safari reliably fires `visualViewport.resize`, which is the signal you can depend on when the keyboard appears.[^5]

### Next.js 15 metadata

```ts
// app/layout.tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  maximumScale: 1,
};
```

This gives you explicit safe-area control and the best native keyboard resize behavior available in supporting browsers.[^1][^2][^6]

### App shell structure

Use a three-zone layout: top chrome, scrollable editor body, and pinned bottom action area. Make the shell `flex h-dvh flex-col overflow-hidden` so the page itself does not scroll, then let only the editor region scroll.[^8][^9]

```tsx
export function NoteEditorShell({ children, toolbar, footer }: Props) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur">
        {toolbar}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>

      <footer className="shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)]">
        {footer}
      </footer>
    </div>
  );
}
```

The `min-h-0` on the scroll area is important in flex layouts so the editor can actually shrink instead of forcing overflow. The footer padding uses the safe-area inset instead of a fixed guess.[^10][^4][^6]

### Visual Viewport hook

Use this when the keyboard overlaps fixed bottom UI on iOS Safari. The hook should compute the keyboard height from `visualViewport.height` and `offsetTop`, then expose it through a CSS variable on `:root`.[^7][^5]

```ts
import { useEffect } from "react";

export function useVisualViewportKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;

    const update = () => {
      const layoutH = window.innerHeight;
      const visualH = vv.height;
      const keyboard = Math.max(0, layoutH - visualH - vv.offsetTop);
      root.style.setProperty("--keyboard-height", `${keyboard}px`);
      root.style.setProperty("--vv-height", `${visualH}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
```

Then pin the footer with a transform or bottom offset:

```tsx
<footer
  className="shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)]"
  style={{ transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))" }}
>
  {footer}
</footer>
```

A transform is usually smoother than animating `bottom`, and it avoids layout thrash while the keyboard is opening.[^5][^7]

### When to prefer each approach

- `dvh`: best for overall shell height and modern browsers.[^9][^8]
- `interactive-widget=resizes-content`: best native setting where supported, especially Chromium-based browsers.[^2][^1]
- Visual Viewport API: required fallback for iOS Safari keyboard avoidance.[^5]


## Mobile toolbar UX

On mobile, do not force the full desktop toolbar into one row. The best pattern is a simplified, horizontally scrollable or grouped toolbar with only the most common actions visible, plus an overflow menu for everything else. Rich text editors commonly switch to a mobile-specific toolbar configuration when the viewport gets narrow.[^11][^12]

### Strong UX patterns

- Keep the primary formatting actions visible: bold, italic, underline, bullets, numbered list.
- Move advanced actions into a `More` menu: headings, quote, code, alignments, link tools, clear formatting.
- Use a horizontally scrollable row only if actions are frequent and discoverable.
- Prefer grouped popovers for dense feature sets, especially when screen width is under 390px.

A good rule is to show 4–6 primary actions and collapse the rest. That preserves speed without making the bar visually noisy.[^12][^11]

### Toolbar layout pattern

```tsx
<div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
  <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    <ToolbarButton />
    <ToolbarButton />
    <ToolbarButton />
    <ToolbarButton />
    <ToolbarMoreMenu />
  </div>
</div>
```

This works well because the toolbar stays accessible, does not wrap awkwardly, and remains usable with one hand. Horizontal overflow is often better than wrapping because wrapping creates unpredictable vertical height changes.[^11][^12]

### Best behavior near keyboard

If the toolbar is meant to stay visible while editing, pin it above the editor body but below the top app bar. Do not place it inside the same fixed footer as the save button, because the keyboard will make the action cluster too crowded. A separate mobile toolbar and bottom action bar is more usable than one giant combined bar.[^11][^5]

## Safe areas and targets

Treat safe area as layout padding, not as a design afterthought. On iPhone-style devices, `env(safe-area-inset-bottom)` is the correct way to keep UI above the home indicator and other system overlays.[^4][^6]

### Safe-area pattern

```tsx
<footer className="border-t bg-background/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
  ...
</footer>
```

If the footer is fixed, apply the same inset to the fixed container and also ensure the scrollable content has enough `padding-bottom` so the last editor line is not hidden behind the controls. That prevents both overlap and dead-space confusion.[^13][^6]

### Touch target rules

Apple guidance recommends a minimum tappable area of 44 x 44 points, and WCAG target-size guidance exists to prevent accidental taps on adjacent controls. The trick is to make the interactive area 44px minimum while keeping the visible icon or pill smaller through padding and alignment choices.[^3][^14]

```tsx
<button className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-md touch-manipulation">
  <BoldIcon className="h-4 w-4" />
</button>
```

For pill buttons or tags, use `min-h-11 px-3` and keep gaps between items around 8–12px. That keeps thumb interaction comfortable without making desktop UI feel bloated.[^15][^3]

### Adaptive sizing with Tailwind

Use responsive classes so mobile gets more generous spacing while desktop stays compact:

```tsx
<button className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm md:min-h-9 md:px-2 md:text-xs">
  Save
</button>
```

This is the cleanest way to keep the mobile tap target compliant while avoiding oversized desktop controls. The visual size can shrink on larger screens, but the hit area should never drop below the mobile minimum on touch devices.[^14][^3]

## Suggested implementation

Here is the architecture I would feed to an AI coding agent:

```tsx
// app/layout.tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  maximumScale: 1,
};
```

```tsx
// components/EditorPage.tsx
"use client";

import { useVisualViewportKeyboard } from "@/hooks/useVisualViewportKeyboard";

export function EditorPage() {
  useVisualViewportKeyboard();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <MobileToolbar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Editor />
      </main>

      <footer
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        style={{ transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))" }}
      >
        <BottomActions />
      </footer>
    </div>
  );
}
```

This structure keeps the editor usable, keeps the footer above the keyboard on iOS, and preserves safe-area spacing on notched devices.[^6][^1][^5]

## Practical defaults

If you want the shortest path to a robust mobile result, use these defaults: `h-dvh` for the shell, `interactive-widget=resizes-content` in metadata, Visual Viewport fallback for iOS, a horizontally scrollable mobile toolbar, and 44px minimum touch targets. Those choices align with the viewport behavior guidance, safe-area usage, and touch target recommendations in the sources.[^3][^4][^1][^2]

Would you like me to turn this into a concrete Next.js/Tailwind component set for your SmartNotes app structure?
<span style="display:none">[^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39]</span>

<div align="center">⁂</div>

[^1]: https://www.htmhell.dev/adventcalendar/2024/4/

[^2]: https://developer.chrome.com/blog/viewport-resize-behavior

[^3]: https://www.lukew.com/ff/entry.asp?1085

[^4]: https://webkit.org/blog/7929/designing-websites-for-iphone-x/

[^5]: https://stackoverflow.com/questions/78844736/how-to-polyfill-interactive-widget-resizes-content-for-meta-viewport-tag-on

[^6]: https://www.webmasterworld.com/mobile_web_design_development/5095892.htm

[^7]: https://www.reddit.com/r/reactjs/comments/1sfnata/dvh_doesnt_solve_the_mobile_keyboard_problem_i/

[^8]: https://www.franciscomoretti.com/blog/fix-mobile-keyboard-overlap-with-visualviewport

[^9]: https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a

[^10]: https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/

[^11]: https://richtexteditor.com/demos/responsive.aspx

[^12]: https://design-patterns.service.justice.gov.uk/archive/rich-text-editor/

[^13]: https://css-tricks.com/almanac/functions/e/env/

[^14]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

[^15]: https://www.humanstandards.org/docs/ergonomics/targets-spacing

[^16]: ai-copilot.md

[^17]: structure.md

[^18]: provider.md

[^19]: note-lifecycle.md

[^20]: implementation-status.md

[^21]: features.md

[^22]: environment.md

[^23]: architecture.md

[^24]: readme.md

[^25]: https://github.com/w3c/csswg-drafts/issues/10464

[^26]: https://www.reddit.com/r/webdev/comments/1mehksi/ios_not_supporting/

[^27]: https://stackoverflow.forums.wiki/viewtopic.php?t=302439

[^28]: https://opensourcebeat.com/article/why-css-dvh-ignores-the-mobile-keyboard-and-how-to-fix-it/

[^29]: https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md

[^30]: https://designsystem.backbase.com/latest/components/web/rich-text-editor-A5iJHjBi

[^31]: https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/

[^32]: https://www.quirksmode.org/blog/archives/2017/10/safeareainset_v.html

[^33]: https://www.reddit.com/r/iOSProgramming/comments/xdvvjq/dimensions_of_the_safe_area_insets_for_all_new/

[^34]: https://stackoverflow.com/questions/47302707/css-safe-area-attributes-doesnt-work-on-iphone-x

[^35]: https://gist.github.com/cvan/6c022ff9b14cf8840e9d28730f75fc14

[^36]: https://www.designengineer.xyz/tools/touch-target

[^37]: https://www.linkedin.com/posts/victor-ponamariov_css-is-developing-faster-than-most-of-us-activity-7430188435463622656-kNce

[^38]: https://stackoverflow.com/questions/73355967/safe-area-inset-bottom-not-working-on-ios-15-safari

[^39]: https://developer.apple.com/forums/thread/687200

