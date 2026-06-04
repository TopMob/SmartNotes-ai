export function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function stripHtml(value: string) {
  if (!value) return "";
  let clean = value;
  

  
  // Replace img tags with [Фото]
  clean = clean.replace(/<img[^>]*>/gi, " [Фото] ");
  
  // Replace api media download links with [Фото]
  clean = clean.replace(/\/api\/media\/google-drive\/download\?fileId=[a-zA-Z0-9-]+/g, " [Фото] ");

  return clean
    .replace(/<[^>]*>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function htmlToPlainText(value: string) {
  if (!value) return "";
  let clean = value;
  clean = clean.replace(/<img[^>]*>/gi, " [Фото] ");
  clean = clean.replace(/\/api\/media\/google-drive\/download\?fileId=[a-zA-Z0-9_-]+/g, " [Фото] ");
  clean = clean.replace(/<\/p>/gi, "\n");
  clean = clean.replace(/<br\s*\/?>/gi, "\n");
  clean = clean.replace(/<\/h[1-6]>/gi, "\n\n");
  clean = clean.replace(/<\/div>/gi, "\n");
  clean = clean.replace(/<\/li>/gi, "\n");
  clean = clean.replace(/<[^>]*>/gu, "");
  return clean
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function normalizeText(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}


