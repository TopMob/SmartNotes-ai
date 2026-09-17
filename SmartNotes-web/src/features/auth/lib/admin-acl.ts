const DEFAULT_ADMIN = "admin@example.com";

export function getAdminEmails(): string[] {
  if (typeof window === "undefined") return [DEFAULT_ADMIN];
  const stored = localStorage.getItem("smartnotes:admin_emails");
  if (!stored) {
    localStorage.setItem("smartnotes:admin_emails", JSON.stringify([DEFAULT_ADMIN]));
    return [DEFAULT_ADMIN];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const normalized = parsed.map(e => String(e).trim().toLowerCase()).filter(Boolean);
      if (!normalized.includes(DEFAULT_ADMIN)) {
        normalized.push(DEFAULT_ADMIN);
      }
      return normalized;
    }
  } catch {}
  return [DEFAULT_ADMIN];
}

export function saveAdminEmails(emails: string[]) {
  if (typeof window === "undefined") return;
  const filtered = Array.from(new Set(emails.map(e => String(e).trim().toLowerCase()))).filter(Boolean);
  if (!filtered.includes(DEFAULT_ADMIN)) {
    filtered.push(DEFAULT_ADMIN);
  }
  localStorage.setItem("smartnotes:admin_emails", JSON.stringify(filtered));
}

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  return list.includes(email.trim().toLowerCase());
}

