export async function submitFeedback(payload: {
  rating: number;
  feedback: string;
  diagnostics: unknown[];
  systemLanguage: string;
  userAgent: string;
}) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to submit feedback");
  }

  return true;
}