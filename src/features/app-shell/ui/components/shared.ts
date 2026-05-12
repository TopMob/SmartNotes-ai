import type { Note } from "@/entities/note";

export type SheetName = "folder" | "note" | "pages" | "lock" | "about" | "create-folder" | "reminder" | "admin-tools" | null;
export type SheetAnchor = { x: number; y: number; placement: "above" | "below" };
export type SheetState = { name: Exclude<SheetName, null>; anchor: SheetAnchor | null } | null;

import { escapeHtml, stripHtml } from "@/shared/utils/string";
export { escapeHtml, stripHtml };

//



export function getSheetAnchor(rect: DOMRect): SheetAnchor {
  const spaceBelow = window.innerHeight - rect.bottom;
  const placement = spaceBelow < 360 && rect.top > 360 ? "above" : "below";

  return {
    x: rect.left + rect.width / 2,
    y: placement === "below" ? rect.bottom + 12 : rect.top - 12,
    placement,
  };
}

export function getNotePlainText(note: Note) {
  return stripHtml([
    note.title,
    ...note.pages.map((page) => `${page.title}\n${stripHtml(page.content)}`),
  ].filter(Boolean).join("\n\n"));
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeFileName(value: string, fallback = "smartnotes-export") {
  return (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/gu, "-")
    .replace(/\s+/gu, " ")
    .slice(0, 80) || fallback;
}

export function exportNoteAsTxt(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя экспортировать до разблокировки.");
    return;
  }

  downloadTextFile(`${safeFileName(note.title, "note")}.txt`, getNotePlainText(note));
}

export function exportNoteForImport(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя экспортировать до разблокировки.");
    return;
  }

  downloadTextFile(
    `${safeFileName(note.title, "note")}.json`,
    JSON.stringify(note, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportNoteAsPdf(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя печатать до разблокировки.");
    return;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(note.title || "Note")}</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:900px;margin:0 auto;color:#111}.meta{color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.12em}.page{margin-top:24px;padding-top:18px;border-top:1px solid #ddd}.content{white-space:pre-wrap;line-height:1.6}</style></head><body><div class="meta">SmartNotes</div><h1>${escapeHtml(note.title || "Без названия")}</h1><div class="content">${escapeHtml(getNotePlainText(note)).replace(/\n/g, "<br>")}</div></body></html>`;
  const preview = window.open("", "_blank", "noopener,noreferrer");

  if (!preview) {
    window.alert("Браузер заблокировал popup печати.");
    return;
  }

  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  preview.focus();
  preview.print();
}

export async function shareText(title: string, text: string) {
  if (typeof window !== "undefined" && typeof window.navigator.share === "function") {
    await navigator.share({ title, text });
    return;
  }

  await window.navigator.clipboard.writeText(text);
}

export async function shareNote(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя шарить до разблокировки.");
    return;
  }

  await shareText(note.title || "SmartNotes note", getNotePlainText(note));
}

export async function shareFolder(folder: { id: string; name: string; description: string | null }) {
  await shareText(folder.name, `${folder.name}\n${folder.description ?? ""}\nFolder ID: ${folder.id}`.trim());
}

export function plainTextToEditorContent(value: string) {
  if (!value.trim()) {
    return "<p></p>";
  }

  if (value.includes("<") && value.includes(">")) {
    return value;
  }

  return value
    .split(/\n+/u)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

export function serializeEditorSnapshot(note: Note) {
  return JSON.stringify({
    title: note.title,
    folderId: note.folderId,
    userTags: note.userTags,
    content: note.content,
    pages: note.pages.map((page) => ({ id: page.id, title: page.title, content: page.content, drawingRevision: page.drawingRevision })),
  });
}
