"use client";

// ---------------------------------------------------------------------------
// AI Notes Chat Panel — RAG chat over user's notes
// ✨ New feature: ask questions, get answers with note citations
// ---------------------------------------------------------------------------

import { Bot, ChevronDown, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";

type Citation = { id: string; title: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  error?: boolean;
};

type AiChatPanelProps = {
  onOpenNote?: (noteId: string) => void;
};

function generateId() {
  return Math.random().toString(36).slice(2);
}

export function AiChatPanel({ onOpenNote }: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = { id: generateId(), role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error("Ошибка запроса к AI.");
      }

      const data = (await response.json()) as { answer: string; citations: Citation[] };
      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        text: data.answer,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Что-то пошло не так. Попробуй ещё раз.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 50);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <>
      {/* FAB trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            animate={{ scale: 1, opacity: 1 }}
            className="fixed bottom-24 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-950/40 hover:bg-violet-500"
            exit={{ scale: 0.8, opacity: 0 }}
            initial={{ scale: 0.8, opacity: 0 }}
            title="Спроси свои заметки"
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            type="button"
            onClick={() => setOpen(true)}
          >
            <MessageCircle className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="fixed bottom-5 right-5 z-50 flex w-[min(96vw,400px)] flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl shadow-violet-950/24 backdrop-blur-2xl"
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            style={{ maxHeight: "min(85vh, 600px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-surface-strong px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">AI по заметкам</p>
                <p className="truncate text-xs text-foreground/48">Отвечает только по твоим заметкам</p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-background"
                type="button"
                onClick={() => setOpen(false)}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-background"
                type="button"
                onClick={() => { setOpen(false); setMessages([]); }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-violet-600/10 text-violet-600">
                    <Bot className="h-7 w-7" />
                  </span>
                  <p className="text-sm font-bold text-foreground/60">
                    Задай вопрос — отвечу по твоим заметкам
                  </p>
                  <div className="grid gap-2">
                    {["Что я знаю о React?", "Мои задачи на эту неделю", "Идеи для проектов"].map((hint) => (
                      <button
                        className="rounded-2xl border border-border bg-surface-strong px-3 py-2 text-xs font-bold text-foreground/70 hover:bg-background"
                        key={hint}
                        type="button"
                        onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  key={msg.id}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white"
                        : msg.error
                          ? "border border-rose-200 bg-rose-50 text-rose-700"
                          : "border border-border bg-surface-strong text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c) => (
                        <button
                          className="rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100"
                          key={c.id}
                          type="button"
                          onClick={() => onOpenNote?.(c.id)}
                        >
                          📄 {c.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-strong px-3.5 py-2.5 text-sm text-foreground/54">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Анализирую заметки…
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-surface-strong p-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                <input
                  ref={inputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/38"
                  disabled={loading}
                  placeholder="Спроси что-нибудь…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
                  disabled={!input.trim() || loading}
                  type="button"
                  onClick={() => void handleSend()}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
