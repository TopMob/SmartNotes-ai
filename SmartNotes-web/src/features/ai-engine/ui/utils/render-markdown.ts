export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-foreground/8 px-1 py-0.5 text-[0.85em] font-mono">$1</code>')
    .replace(/\[Note: "(.+?)"\]/g, (_, t) => {
      const attrTitle = t.replace(/"/g, "&quot;");
      return `<button class="note-link-inline font-black text-violet-600 hover:underline hover:text-violet-800" data-note-title="${attrTitle}">[${t}]</button>`;
    })
    .replace(/\n\n/g, "</p><p class=\"mt-2\">")
    .replace(/\n/g, "<br/>");
}
