export function getAdminEmails(): string[] {
  if (typeof window === "undefined") return ["shazak6430@gmail.com"];
  const stored = localStorage.getItem("smartnotes:admin_emails");
  if (!stored) {
    localStorage.setItem("smartnotes:admin_emails", JSON.stringify(["shazak6430@gmail.com"]));
    return ["shazak6430@gmail.com"];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const normalized = parsed.map(e => String(e).trim().toLowerCase()).filter(Boolean);
      if (!normalized.includes("shazak6430@gmail.com")) {
        normalized.push("shazak6430@gmail.com");
      }
      return normalized;
    }
  } catch {}
  return ["shazak6430@gmail.com"];
}

export function saveAdminEmails(emails: string[]) {
  if (typeof window === "undefined") return;
  const filtered = Array.from(new Set(emails.map(e => String(e).trim().toLowerCase()))).filter(Boolean);
  if (!filtered.includes("shazak6430@gmail.com")) {
    filtered.push("shazak6430@gmail.com");
  }
  localStorage.setItem("smartnotes:admin_emails", JSON.stringify(filtered));
}

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  return list.includes(email.trim().toLowerCase());
}
