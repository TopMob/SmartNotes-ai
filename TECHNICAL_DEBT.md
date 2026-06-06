# Technical Debt Audit

## Export System (shared.ts)

1. **Sequential Image Loading**:
   - In `exportNoteAsPng`, block images are loaded sequentially in a `for...of` loop. If there are multiple external network images, they will load one after another instead of in parallel. Since most images are base64-encoded local attachments, this impact is minimal, but could be optimized.

2. **Fixed Canvas Sizing**:
   - The canvas width is hardcoded to 800px in `exportNoteAsPng`. Ideally, this could be configurable or dynamic based on the user's viewport or image sizes.

3. **Client-Side Dependency**:
   - Both PDF and PNG exports rely entirely on browser-native APIs (`DOMParser`, Canvas, iframe, `FileReader`). They cannot be executed on the server side or in a non-browser environment.

## General Project Code (Lint Warnings)

1. **Next.js Image Optimizations**:
   - `SettingsClient.tsx` and `Sidebar.tsx` contain warnings regarding the use of native `<img>` elements instead of `next/image`'s `<Image />` component (`@next/next/no-img-element`).

2. **Unused Code**:
   - `share-prompt.tsx` has an unused argument warning: `'onClose' is defined but never used`.
