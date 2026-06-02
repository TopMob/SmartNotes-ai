import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { isGuestUser } from "@/features/auth/lib/guest-session";
import type { Note } from "@/entities/note";
import type { AiAction, AiActionExecutionResult } from "@/features/ai-engine/model/agent-actions";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

export type Citation = { id: string; title: string };

export type Message = {
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

interface UseAiChatProps {
  activeNote?: Note | null;
  onOpenNote?: (noteId: string) => void;
  open: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

export function useAiChat({ activeNote, onOpenNote, open }: UseAiChatProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: notes = [] } = useNotesFlat();
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

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  }, []);

  const handleExecuteActions = useCallback(async (msgId: string, actionsList: AiAction[] = []) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionsStatus: "running", actionError: undefined } : m))
    );

    try {
      if (!user?.id || isGuestUser(user)) {
        throw new Error("AI-действия недоступны в гостевом режиме. Зарегистрируйтесь, чтобы сохранять изменения.");
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
          m.id === msgId
            ? { ...m, actionsStatus: "completed", actionResults: results, actionError: undefined }
            : m
        )
      );

      if (createdNoteResult?.createdNoteId) {
        onOpenNote?.(createdNoteResult.createdNoteId);
      }
    } catch (error) {
      console.error("Failed to execute agent actions:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionsStatus: "error",
                actionError: error instanceof Error ? error.message : "Ошибка применения.",
              }
            : m
        )
      );
    }
  }, [messages, onOpenNote, queryClient, user?.id]);

  const handleSend = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;

    const lowerQuestion = question.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    const affirmativeWords = ["да", "делай", "сделай", "ок", "ok", "давай", "подтверждаю", "выполняй", "применяй", "go ahead", "do it", "yes"];
    const lastAssistantMsgIndex = [...messages].reverse().findIndex(m => m.role === "assistant" && m.actions && m.actions.length > 0 && m.actionsStatus === "pending");

    if (lastAssistantMsgIndex !== -1 && affirmativeWords.includes(lowerQuestion)) {
      const realIndex = messages.length - 1 - lastAssistantMsgIndex;
      const targetMsg = messages[realIndex];
      setInput("");
      await handleExecuteActions(targetMsg.id, targetMsg.actions);
      return;
    }

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
      const isGuest = isGuestUser(user);
      const notesPayload = isGuest
        ? notes.map((n) => ({
            id: n.id,
            title: n.title,
            folderId: n.folderId,
            userTags: n.userTags || [],
            content: n.content || "",
          }))
        : undefined;

      const foldersPayload = isGuest
        ? rawFolders.map((f) => ({
            id: f.id,
            name: f.name,
          }))
        : undefined;

      const supabase = createSupabaseBrowserClient();
      let token = "";
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || "";
      }

      const gatewayUrl = process.env.NEXT_PUBLIC_RAILWAY_GATEWAY_URL;
      const url = gatewayUrl ? `${gatewayUrl}/chat` : "/api/ai/chat";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          messages: messages.map((message) => ({ role: message.role, text: message.text })),
          notes: notesPayload,
          folders: foldersPayload,
          activeNoteId: activeNote?.id ?? null,
          activeNoteTitle: activeNote?.title ?? null,
          activeNoteContent: activeNote
            ? activeNote.content || activeNote.pages?.map((p) => p.content).join("\n") || ""
            : null,
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
            : m
        )
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: error instanceof Error ? error.message : "Что-то пошло не так. Попробуй ещё раз.",
                error: true,
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages, notes, rawFolders, user, activeNote, handleExecuteActions]);

  const handleConfirmDanger = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, confirmDanger: true } : m)));
  }, []);

  const handleDismissActions = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, actionsStatus: undefined } : m)));
  }, []);

  const handleMessageClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
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
    },
    [notes, onOpenNote]
  );

  return {
    messages,
    input,
    setInput,
    loading,
    inputRef,
    bottomRef,
    handleSend,
    handleClear,
    handleExecuteActions,
    handleConfirmDanger,
    handleDismissActions,
    handleMessageClick,
    rawFolders,
    notes,
  };
}
