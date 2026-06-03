import type { Note } from "@/entities/note";

export type SheetName = "folder" | "note" | "pages" | "lock" | "about" | "create-folder" | "reminder" | "admin-tools" | "share" | "invites" | null;
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
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
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

  const lines: string[] = [];
  lines.push(note.title || "Без названия");
  lines.push("");

  const totalPages = note.pages.length;
  note.pages.forEach((page, index) => {
    if (totalPages > 1) {
      lines.push(`Страница ${index + 1}${page.title ? `: ${page.title}` : ""}`);
      lines.push("=".repeat(20));
    }
    lines.push(stripHtml(page.content));
    lines.push("");
  });

  if (note.userTags && note.userTags.length > 0) {
    lines.push("Теги: " + note.userTags.map(t => `#${t}`).join(", "));
  }

  downloadTextFile(`${safeFileName(note.title, "note")}.txt`, lines.join("\n").trim());
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
    try {
      await navigator.share({ title, text });
      return;
    } catch {
    }
  }

  try {
    await window.navigator.clipboard.writeText(text);
    window.alert("Информация скопирована в буфер обмена");
  } catch {
    window.alert("Не удалось скопировать в буфер обмена");
  }
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

export function exportNoteAsPng(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя экспортировать до разблокировки.");
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 800;
  const padding = 50;
  const contentWidth = width - padding * 2;

  const titleFont = "900 32px system-ui, -apple-system, sans-serif";
  const sectionFont = "bold 20px system-ui, -apple-system, sans-serif";
  const bodyFont = "16px system-ui, -apple-system, sans-serif";
  const tagFont = "bold 14px system-ui, -apple-system, sans-serif";
  const footerFont = "12px system-ui, -apple-system, sans-serif";

  function wrapText(text: string, font: string, maxWidth: number): string[] {
    ctx!.font = font;
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    paragraphs.forEach((para) => {
      const words = para.split(" ");
      let currentLine = "";

      words.forEach((word) => {
        const testLine = currentLine ? currentLine + " " + word : word;
        const metrics = ctx!.measureText(testLine);
        if (metrics.width > maxWidth) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);
      else lines.push("");
    });
    return lines;
  }

  const wrappedTitle = wrapText(note.title || "Без названия", titleFont, contentWidth);
  
  type RenderItem = { type: "title" | "section" | "body" | "tag" | "footer"; text: string; height: number };
  const items: RenderItem[] = [];

  wrappedTitle.forEach(t => items.push({ type: "title", text: t, height: 40 }));
  items.push({ type: "body", text: "", height: 20 });

  const totalPages = note.pages.length;
  note.pages.forEach((page, index) => {
    if (totalPages > 1) {
      items.push({ type: "section", text: `Страница ${index + 1}${page.title ? `: ${page.title}` : ""}`, height: 30 });
    }
    const plainText = stripHtml(page.content);
    const wrappedContent = wrapText(plainText, bodyFont, contentWidth);
    wrappedContent.forEach(t => {
      items.push({ type: "body", text: t, height: 24 });
    });
    items.push({ type: "body", text: "", height: 20 });
  });

  if (note.userTags && note.userTags.length > 0) {
    const tagsText = "Теги: " + note.userTags.map(t => `#${t}`).join(", ");
    const wrappedTags = wrapText(tagsText, tagFont, contentWidth);
    wrappedTags.forEach(t => items.push({ type: "tag", text: t, height: 24 }));
    items.push({ type: "body", text: "", height: 10 });
  }

  items.push({ type: "footer", text: "Создано в SmartNotes", height: 20 });

  let totalHeight = padding * 2;
  items.forEach(item => totalHeight += item.height);

  canvas.width = width;
  canvas.height = totalHeight;

  const grad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  grad.addColorStop(0, "#0c0a09");
  grad.addColorStop(1, "#1c1917");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, totalHeight);

  ctx.strokeStyle = "rgba(255, 138, 29, 0.04)";
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, totalHeight);
    ctx.stroke();
  }
  for (let y = 0; y < totalHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  let currentY = padding;
  items.forEach((item) => {
    if (item.type === "title") {
      ctx.font = titleFont;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(item.text, padding, currentY + 28);
    } else if (item.type === "section") {
      ctx.font = sectionFont;
      ctx.fillStyle = "#ff8a1d";
      ctx.fillText(item.text, padding, currentY + 18);
    } else if (item.type === "body") {
      ctx.font = bodyFont;
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText(item.text, padding, currentY + 16);
    } else if (item.type === "tag") {
      ctx.font = tagFont;
      ctx.fillStyle = "#ff8a1d";
      ctx.fillText(item.text, padding, currentY + 16);
    } else if (item.type === "footer") {
      ctx.font = footerFont;
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillText(item.text, padding, currentY + 12);
    }
    currentY += item.height;
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(note.title, "note")}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

