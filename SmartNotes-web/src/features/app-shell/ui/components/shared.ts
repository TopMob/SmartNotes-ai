import type { Note } from "@/entities/note";

export type SheetName = "folder" | "note" | "pages" | "lock" | "about" | "create-folder" | "reminder" | "admin-tools" | "share" | "share-folder" | "invites" | "note-folder-picker" | "note-export" | null;
export type SheetAnchor = { x: number; y: number; placement: "above" | "below" };
export type SheetState = { name: Exclude<SheetName, null>; anchor: SheetAnchor | null } | null;

import { escapeHtml, stripHtml, htmlToPlainText } from "@/shared/utils/string";
export { escapeHtml, stripHtml, htmlToPlainText };

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
  const pagesText = note.pages && note.pages.length > 0
    ? note.pages.map((page) => `${page.title}\n${htmlToPlainText(page.content)}`).join("\n\n")
    : htmlToPlainText(note.content);

  return [
    note.title,
    pagesText,
  ].filter(Boolean).join("\n\n");
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

  if (note.pages && note.pages.length > 0) {
    const totalPages = note.pages.length;
    note.pages.forEach((page, index) => {
      if (totalPages > 1) {
        lines.push(`Страница ${index + 1}${page.title ? `: ${page.title}` : ""}`);
        lines.push("=".repeat(20));
      }
      lines.push(htmlToPlainText(page.content));
      lines.push("");
    });
  } else if (note.content) {
    lines.push(htmlToPlainText(note.content));
    lines.push("");
  }

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

async function resolveLocalMediaUrls(html: string): Promise<string> {
  if (typeof window === "undefined" || !html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = doc.querySelectorAll("img");

  if (images.length === 0) return html;

  const { getLocalMedia } = await import("@/shared/utils/local-media-db");

  for (const img of Array.from(images)) {
    const src = img.getAttribute("src");
    if (src && src.startsWith("local-media:")) {
      const fileId = src.replace("local-media:", "");
      try {
        const blob = await getLocalMedia(fileId);
        if (blob) {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          img.setAttribute("src", dataUrl);
        }
      } catch (err) {
        console.error("Failed to load local media for export:", err);
      }
    }
  }

  return doc.body.innerHTML;
}

function extractBlocks(html: string): { type: "text" | "image"; content: string }[] {
  if (typeof window === "undefined" || !html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blocks: { type: "text" | "image"; content: string }[] = [];

  const walk = (el: Element) => {
    if (el.tagName.toLowerCase() === "img") {
      const src = el.getAttribute("src");
      if (src) {
        blocks.push({ type: "image", content: src });
      }
    } else if (el.tagName.toLowerCase() === "p" || el.tagName.match(/^h[1-6]$/i) || el.tagName.toLowerCase() === "li" || el.tagName.toLowerCase() === "blockquote" || el.tagName.toLowerCase() === "pre") {
      const childImgs = el.querySelectorAll("img");
      if (childImgs.length > 0) {
        Array.from(el.childNodes).forEach((childNode) => {
          if (childNode.nodeType === Node.ELEMENT_NODE) {
            walk(childNode as Element);
          } else if (childNode.nodeType === Node.TEXT_NODE) {
            const text = childNode.textContent?.trim();
            if (text) {
              blocks.push({ type: "text", content: text });
            }
          }
        });
      } else {
        const text = htmlToPlainText(el.outerHTML);
        if (text) {
          blocks.push({ type: "text", content: text });
        }
      }
    } else {
      Array.from(el.children).forEach(walk);
    }
  };

  Array.from(doc.body.children).forEach((child) => {
    walk(child);
  });

  if (blocks.length === 0 && doc.body.childNodes.length > 0) {
    Array.from(doc.body.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node as Element);
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          blocks.push({ type: "text", content: text });
        }
      }
    });
  }

  return blocks;
}

export async function exportNoteAsPdf(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя печатать до разблокировки.");
    return;
  }

  let processedPages: typeof note.pages = [];
  if (note.pages && note.pages.length > 0) {
    processedPages = await Promise.all(
      note.pages.map(async (page) => ({
        ...page,
        content: await resolveLocalMediaUrls(page.content)
      }))
    );
  }
  const processedContent = await resolveLocalMediaUrls(note.content);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.alert("Не удалось запустить печать.");
    document.body.removeChild(iframe);
    return;
  }

  const contentHtml = processedPages.length > 0
    ? processedPages.map((page, index) => {
        const pageTitleHtml = processedPages.length > 1
          ? `<h2 class="page-title">Страница ${index + 1}${page.title ? `: ${escapeHtml(page.title)}` : ""}</h2>`
          : "";
        return `<div class="page">${pageTitleHtml}<div class="page-content">${page.content}</div></div>`;
      }).join("")
    : `<div class="page-content">${processedContent}</div>`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(note.title || "Note")}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      color: #111;
      line-height: 1.6;
    }
    h1 {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 24px;
    }
    .page {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
    .page:first-of-type {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #555;
      margin-bottom: 16px;
    }
    .page-content {
      font-size: 16px;
      color: #222;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      margin: 16px 0;
      display: block;
    }
    ul, ol {
      padding-left: 20px;
      margin: 12px 0;
    }
    li {
      margin-bottom: 6px;
    }
    a {
      color: #1455d9;
      text-decoration: underline;
    }
    pre, code {
      font-family: monospace;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre {
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      margin: 16px 0;
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title || "Без названия")}</h1>
  ${contentHtml}
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  const images = doc.getElementsByTagName("img");
  const promises = Array.from(images).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  });

  Promise.all(promises).then(() => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  });
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

export async function exportNoteAsPng(note: Note) {
  if (note.lock?.hidden) {
    window.alert("Защищенные заметки нельзя экспортировать до разблокировки.");
    return;
  }

  let processedPages: typeof note.pages = [];
  if (note.pages && note.pages.length > 0) {
    processedPages = await Promise.all(
      note.pages.map(async (page) => ({
        ...page,
        content: await resolveLocalMediaUrls(page.content)
      }))
    );
  }
  const processedContent = await resolveLocalMediaUrls(note.content);

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
  
  type RenderItem = 
    | { type: "title"; text: string; height: number }
    | { type: "section"; text: string; height: number }
    | { type: "body"; text: string; height: number }
    | { type: "image"; img: HTMLImageElement; drawWidth: number; drawHeight: number; height: number }
    | { type: "tag"; text: string; height: number };

  const items: RenderItem[] = [];

  wrappedTitle.forEach(t => items.push({ type: "title", text: t, height: 40 }));
  items.push({ type: "body", text: "", height: 20 });

  const totalPages = processedPages.length;
  
  async function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
  }

  async function processBlocks(blocks: { type: "text" | "image"; content: string }[]) {
    for (const block of blocks) {
      if (block.type === "image") {
        try {
          const img = await loadImageElement(block.content);
          const drawWidth = img.naturalWidth > contentWidth ? contentWidth : img.naturalWidth;
          const drawHeight = img.naturalHeight * (drawWidth / img.naturalWidth);
          items.push({
            type: "image",
            img,
            drawWidth,
            drawHeight,
            height: drawHeight + 24
          });
        } catch (err) {
          console.error("Failed to load image for PNG export:", err);
          const wrapped = wrapText("[Фото]", bodyFont, contentWidth);
          wrapped.forEach(t => items.push({ type: "body", text: t, height: 24 }));
        }
      } else {
        const wrappedContent = wrapText(block.content, bodyFont, contentWidth);
        wrappedContent.forEach(t => {
          items.push({ type: "body", text: t, height: 24 });
        });
      }
    }
  }

  if (totalPages > 0) {
    for (let index = 0; index < totalPages; index++) {
      const page = processedPages[index];
      if (totalPages > 1) {
        items.push({ type: "section", text: `Страница ${index + 1}${page.title ? `: ${page.title}` : ""}`, height: 30 });
      }
      const blocks = extractBlocks(page.content);
      await processBlocks(blocks);
      items.push({ type: "body", text: "", height: 20 });
    }
  } else if (processedContent) {
    const blocks = extractBlocks(processedContent);
    await processBlocks(blocks);
    items.push({ type: "body", text: "", height: 20 });
  }

  if (note.userTags && note.userTags.length > 0) {
    const tagsText = "Теги: " + note.userTags.map(t => `#${t}`).join(", ");
    const wrappedTags = wrapText(tagsText, tagFont, contentWidth);
    wrappedTags.forEach(t => items.push({ type: "tag", text: t, height: 24 }));
    items.push({ type: "body", text: "", height: 10 });
  }

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
  for (const item of items) {
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
    } else if (item.type === "image") {
      const xOffset = padding + (contentWidth - item.drawWidth) / 2;
      ctx.save();
      const radius = 12;
      const x = xOffset;
      const y = currentY;
      const w = item.drawWidth;
      const h = item.drawHeight;
      
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      
      ctx.clip();
      ctx.drawImage(item.img, x, y, w, h);
      ctx.restore();
    } else if (item.type === "tag") {
      ctx.font = tagFont;
      ctx.fillStyle = "#ff8a1d";
      ctx.fillText(item.text, padding, currentY + 16);
    }
    currentY += item.height;
  }

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

