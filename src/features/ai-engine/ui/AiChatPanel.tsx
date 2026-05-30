"use client";

import {
  Bot,
  ChevronRight,
  Copy,
  RotateCcw,
  Send,
  Sparkles,
  X,
  FolderPlus,
  FolderInput,
  Tag,
  CheckCircle2,
  Loader2,
  Play,
  AlertTriangle,
  FilePlus2,
  Pencil,
  Trash2,
  Archive,
  Combine,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUiStore } from "@/shared/store/ui-store";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import type { AiAction, AiActionExecutionResult } from "@/features/ai-engine/model/agent-actions";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { Note } from "@/entities/note";





type Citation = { id: string; title: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  error?: boolean;
  streaming?: boolean;
  actions?: AiAction[];
  actionsStatus?: "pending" | "running" | "completed" | "error";
  actionResults?: AiActionExecutionResult[];
  actionError?: string;
  confirmDanger?: boolean;
};

type AiChatPanelProps = {
  onOpenNote?: (noteId: string) => void;
  activeNote?: Note | null;
};





function generateId() {
  return Math.random().toString(36).slice(2);
}

function isDangerousAction(action: AiAction) {
  return action.type === "deleteFolder" || action.type === "deleteNotes" || action.type === "mergeFolders" || action.type === "mergeNotes";
}

/** Lightweight markdown → HTML (bold, italic, lists, links) */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class=\"rounded bg-foreground/8 px-1 py-0.5 text-[0.85em] font-mono\">$1</code>")
    .replace(/\[Note: "(.+?)"\]/g, (_, t) => {
      const attrTitle = t.replace(/"/g, "&quot;");
      return `<button class="note-link-inline font-black text-violet-600 hover:underline hover:text-violet-800" data-note-title="${attrTitle}">[${t}]</button>`;
    })
    .replace(/\n\n/g, "</p><p class=\"mt-2\">")
    .replace(/\n/g, "<br/>");
}

const QUICK_PROMPTS = [
  "Что я знаю о React?",
  "Мои задачи на эту неделю",
  "Идеи для проектов",
  "Заметки по дизайну",
];





export function AiChatPanel({ onOpenNote, activeNote }: AiChatPanelProps) {
  const queryClient = useQueryClient();
  const open = useUiStore((s) => s.aiChatOpen);
  const setAiChatOpen = useUiStore((s) => s.setAiChatOpen);
  const { data: notes = [] } = useNotesFlat();
  const user = useAuthStore((s) => s.user);
  const { data: rawFolders = [] } = useFoldersQuery();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setAiChatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setAiChatOpen]);

  const handleSend = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: Message = { id: generateId(), role: "user", text: question };
    const assistantId = generateId();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          messages: messages.map((message) => ({ role: message.role, text: message.text })),
          notes: notes.map((n) => ({
            id: n.id,
            title: n.title,
            folderId: n.folderId,
            userTags: n.userTags || [],
          })),
          folders: rawFolders.map((f) => ({
            id: f.id,
            name: f.name,
          })),
          activeNoteId: activeNote?.id ?? null,
          activeNoteTitle: activeNote?.title ?? null,
          activeNoteContent: activeNote ? (activeNote.content || activeNote.pages?.map(p => p.content).join("\n") || "") : null,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = (await response.json()) as {
        answer: string;
        citations: Citation[];
        actions?: AiAction[];
      };

      const citations = data.citations ?? [];

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { 
                ...m, 
                text: data.answer,
                citations, 
                streaming: false,
                actions: data.actions ?? [],
                actionsStatus: data.actions && data.actions.length > 0 ? "pending" : undefined,
              }
            : m,
        ),
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text:
                  error instanceof Error
                    ? error.message
                    : "Что-то пошло не так. Попробуй ещё раз.",
                error: true,
                streaming: false,
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages, notes, rawFolders]);

  const handleExecuteActions = useCallback(async (msgId: string, actionsList: AiAction[] = []) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, actionsStatus: "running", actionError: undefined } : m))
      );

    try {
      if (!user?.id) {
        throw new Error("Для выполнения AI-действий нужен авторизованный аккаунт.");
      }

      const response = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: actionsList,
          requestMessage: messages.find((message) => message.id === msgId)?.text ?? "",
          conversationExcerpt: messages.slice(-8).map((message) => ({ role: message.role, text: message.text })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        results?: AiActionExecutionResult[];
      };

      if (!response.ok) {
        throw new Error(payload.error || `Ошибка сервера: ${response.status}`);
      }

      const results = payload.results ?? [];
      const failed = results.find((result) => !result.success);

      if (failed) {
        throw new Error(failed.message);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notes(user.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders(user.id) }),
      ]);

      const createdNoteResult = results.find((result) => result.createdNoteId);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, actionsStatus: "completed", actionResults: results, actionError: undefined } : m,
        )
      );

      if (createdNoteResult?.createdNoteId) {
        onOpenNote?.(createdNoteResult.createdNoteId);
      }

    } catch (error) {
      console.error("Failed to execute agent actions:", error);
      setMessages((prev) =>
        prev.map((m) => (
          m.id === msgId
            ? {
                ...m,
                actionsStatus: "error",
                actionError: error instanceof Error ? error.message : "Ошибка применения.",
              }
            : m
        ))
      );
    }
  }, [messages, onOpenNote, queryClient, user?.id]);

  const handleConfirmDanger = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, confirmDanger: true } : m)));
  }, []);

  const handleDismissActions = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionsStatus: undefined } : m))
    );
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  }

  function handleCopy(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  const handleMessageClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest(".note-link-inline");
    if (button) {
      const title = button.getAttribute("data-note-title");
      if (title) {
        const found = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
        if (found) {
          onOpenNote?.(found.id);
        } else {
          window.alert(`Заметка "${title}" не найдена.`);
        }
      }
    }
  }, [notes, onOpenNote]);

  const isEmpty = messages.length === 0;

  return (
    <>

      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setAiChatOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Slide-in panel — right side, Gmail-style */}
      <AnimatePresence>
        {open && (
          <motion.aside
            animate={{ x: 0, opacity: 1 }}
            aria-label="AI чат по заметкам"
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface-strong/95 shadow-2xl shadow-violet-950/20 backdrop-blur-md sm:w-[420px]"
            exit={{ x: "100%", opacity: 0 }}
            id="ai-chat-panel"
            initial={{ x: "100%", opacity: 0 }}
            role="complementary"
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.18 }}
            style={{ willChange: "transform, opacity" }}
          >
            {/* ── Header ── */}
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-strong px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">AI по заметкам</p>
                <p className="truncate text-xs text-foreground/48">
                  Отвечает только по твоим заметкам
                </p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background"
                    title="Очистить историю"
                    type="button"
                    onClick={handleClear}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background"
                  title="Закрыть"
                  type="button"
                  onClick={() => setAiChatOpen(false)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background"
                  title="Закрыть и очистить"
                  type="button"
                  onClick={() => { handleClear(); setAiChatOpen(false); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* ── Messages ── */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">

              {/* Empty state */}
              {isEmpty && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-violet-600/10 text-violet-600">
                    <Bot className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-sm font-black">Твой AI-гид по заметкам</p>
                    <p className="mt-1 text-xs text-foreground/54">
                      Задай вопрос — найду ответ в твоих заметках
                    </p>
                  </div>
                  <div className="grid w-full gap-2">
                    {QUICK_PROMPTS.map((hint) => (
                      <button
                        className="rounded-2xl border border-border bg-surface-strong px-3 py-2.5 text-left text-sm font-semibold text-foreground/70 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        key={hint}
                        type="button"
                        onClick={() => void handleSend(hint)}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <div
                  className={`group flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  key={msg.id}
                >
                  {/* Bubble */}
                  <div
                    className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white"
                        : msg.error
                          ? "border border-rose-200 bg-rose-50 text-rose-700"
                          : "border border-border bg-surface-strong text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.error ? (
                      <span
                        onClick={handleMessageClick}
                        dangerouslySetInnerHTML={{
                          __html: `<p>${renderMarkdown(msg.text)}</p>`,
                        }}
                      />
                    ) : (
                      <span>{msg.text}</span>
                    )}

                    {/* Streaming cursor */}
                    {msg.streaming && (
                      <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current opacity-70" />
                    )}

                    {/* Copy button */}
                    {msg.role === "assistant" && !msg.streaming && !msg.error && (
                      <button
                        className="absolute -right-8 top-2 hidden h-6 w-6 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground/70 group-hover:flex"
                        title="Скопировать"
                        type="button"
                        onClick={() => handleCopy(msg.text)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Citation chips */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pr-8">
                      <span className="text-xs text-foreground/40">Источники:</span>
                      {msg.citations.map((c) => (
                        <button
                          className="rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100 hover:shadow-sm"
                          key={c.id}
                          type="button"
                          onClick={() => onOpenNote?.(c.id)}
                        >
                          📄 {c.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Agent Action Card */}
                  {msg.actions && msg.actions.length > 0 && msg.actionsStatus && (
                    <div className="mt-3 w-[92%] overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50/30 p-3.5 shadow-sm dark:border-violet-950/30 dark:from-violet-950/10 dark:to-indigo-950/5">
                      <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                        <Sparkles className="h-4 w-4 fill-violet-200 dark:fill-violet-950" />
                        <span className="text-xs font-black uppercase tracking-wider">⚡ AI Предложение</span>
                      </div>

                      <div className="mt-2.5 space-y-2">
                        {msg.actions.map((act, idx: number) => {
                          if (act.type === "createFolder") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  Создать папку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.folderName}»</strong>
                                </span>
                              </div>
                            );
                          }
                          if (act.type === "renameFolder") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>Переименовать папку в <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.name}»</strong></span>
                              </div>
                            );
                          }
                          if (act.type === "trashFolder" || act.type === "restoreFolder" || act.type === "deleteFolder") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  {act.type === "trashFolder" ? "Переместить папку в корзину" : act.type === "restoreFolder" ? "Восстановить папку" : "Удалить папку навсегда"}
                                </span>
                              </div>
                            );
                          }
                          if (act.type === "mergeFolders") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Combine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>Объединить {act.sourceFolderIds.length} папки</span>
                              </div>
                            );
                          }
                          if (act.type === "createNote") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <FilePlus2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>Создать заметку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong></span>
                              </div>
                            );
                          }
                          if (act.type === "updateNote" || act.type === "renameNote") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>{act.type === "renameNote" ? `Переименовать заметку в «${act.title}»` : "Обновить содержимое заметки"}</span>
                              </div>
                            );
                          }
                          if (act.type === "moveNotesToFolder") {
                            const notesCount = act.noteIds?.length ?? 0;
                            const targetFolderName = act.folderName ?? rawFolders.find((folder) => folder.id === act.folderId)?.name ?? null;
                            const noteNames = act.noteIds
                              ? act.noteIds
                                  .map((nid: string) => notes.find((n) => n.id === nid)?.title || "Без названия")
                                  .join(", ")
                              : "";
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <FolderInput className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  {targetFolderName ? (
                                    <>
                                      Перенести {notesCount} заметку(-и) в папку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{targetFolderName}»</strong>
                                    </>
                                  ) : (
                                    <>
                                      Убрать папку у {notesCount} заметки(-ок)
                                    </>
                                  )}
                                  <span className="block mt-0.5 text-[10px] text-foreground/45">({noteNames})</span>
                                </span>
                              </div>
                            );
                          }
                          if (act.type === "mergeNotes") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Combine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>Объединить {act.noteIds.length} заметки в <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong></span>
                              </div>
                            );
                          }
                          if (act.type === "trashNotes" || act.type === "restoreNotes" || act.type === "deleteNotes") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  {act.type === "trashNotes" ? "Переместить заметки в корзину" : act.type === "restoreNotes" ? "Восстановить заметки" : "Удалить заметки навсегда"}
                                </span>
                              </div>
                            );
                          }
                          if (act.type === "archiveNotes" || act.type === "unarchiveNotes") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>{act.type === "archiveNotes" ? "Архивировать заметки" : "Убрать заметки из архива"}</span>
                              </div>
                            );
                          }
                          if (act.type === "addTagsToNotes") {
                            const notesCount = act.noteIds?.length ?? 0;
                            const tagsList = act.tags?.join(", ") ?? "";
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  Добавить теги <strong className="font-semibold text-violet-700 dark:text-violet-400">[{tagsList}]</strong> к {notesCount} заметке(-ам)
                                </span>
                              </div>
                            );
                          }
                          if (act.type === "removeTagsFromNotes") {
                            const notesCount = act.noteIds?.length ?? 0;
                            const tagsList = act.tags?.join(", ") ?? "";
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>Убрать теги <strong className="font-semibold text-violet-700 dark:text-violet-400">[{tagsList}]</strong> у {notesCount} заметке(-ок)</span>
                              </div>
                            );
                          }
                          if (act.type === "createStructuredIdeaNote") {
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                                <span>
                                  Создать структурированную заметку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong>
                                  <span className="mt-0.5 block text-[10px] text-foreground/45">
                                    Режим: {act.saveMode === "human_plus_ai" ? "Human + AI" : "AI only"}
                                  </span>
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <div className="mt-3.5 border-t border-violet-100/50 pt-3 dark:border-violet-950/20">
                        {msg.actions.some(isDangerousAction) && msg.actionsStatus === "pending" ? (
                          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            Это опасное действие: удаление или объединение. Нужна отдельная явная проверка.
                          </div>
                        ) : null}

                        <div className="flex items-center justify-end">
                          {msg.actionsStatus === "pending" && (
                            <div className="flex gap-2">
                              <button
                                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground/70 transition hover:bg-surface-strong"
                                type="button"
                                onClick={() => handleDismissActions(msg.id)}
                              >
                                Пропустить
                              </button>
                              {msg.actions.some(isDangerousAction) && !msg.confirmDanger ? (
                                <button
                                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-1.5 text-xs font-black text-amber-900 transition hover:bg-amber-200 active:scale-95 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                                  type="button"
                                  onClick={() => handleConfirmDanger(msg.id)}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Подтвердить риск
                                </button>
                              ) : (
                                <button
                                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-violet-600/20 transition hover:bg-violet-500 active:scale-95"
                                  type="button"
                                  onClick={() => void handleExecuteActions(msg.id, msg.actions)}
                                >
                                  <Play className="h-3 w-3 fill-current" />
                                  {msg.actions.some(isDangerousAction) ? "Выполнить опасное действие" : "Выполнить"}
                                </button>
                              )}
                            </div>
                          )}

                          {msg.actionsStatus === "running" && (
                            <div className="flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Применяю изменения...</span>
                            </div>
                          )}

                          {msg.actionsStatus === "completed" && (
                            <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Готово! Изменения применены.</span>
                            </div>
                          )}

                          {msg.actionsStatus === "error" && (
                            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span>{msg.actionError || "Ошибка применения."}</span>
                              <button
                                className="ml-2 underline"
                                type="button"
                                onClick={() => void handleExecuteActions(msg.id, msg.actions)}
                              >
                                Повторить
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && !messages.some((m) => m.streaming) && (
                <div className="flex items-start">
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground/54 shadow-sm">
                    <div className="flex space-x-1 items-center justify-center">
                      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.3s]" />
                      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.15s]" />
                      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-600" />
                    </div>
                    <span>AI думает…</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input area ── */}
            <div className="shrink-0 border-t border-border bg-surface-strong p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 transition">
                <textarea
                  ref={inputRef}
                  className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-foreground/38"
                  disabled={loading}
                  id="ai-chat-input"
                  placeholder="Спроси что-нибудь о своих заметках…"
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);

                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                />
                <button
                  aria-label="Отправить"
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition disabled:opacity-40 hover:bg-violet-500 active:scale-95"
                  disabled={!input.trim() || loading}
                  type="button"
                  onClick={() => void handleSend()}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-foreground/32">
                Enter — отправить · Shift+Enter — новая строка
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
