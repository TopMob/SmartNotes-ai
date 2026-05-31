import { Copy } from "lucide-react";
import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import type { AiAction } from "@/features/ai-engine/model/agent-actions";
import { renderMarkdown } from "../utils/render-markdown";
import { AgentActionCard } from "./AgentActionCard";
import type { Message } from "../../hooks/use-ai-chat";

interface ChatMessageItemProps {
  msg: Message;
  notes: Note[];
  rawFolders: FolderEntity[];
  onOpenNote?: (noteId: string) => void;
  onMessageClick: (e: React.MouseEvent<HTMLSpanElement>) => void;
  onConfirmDanger: (msgId: string) => void;
  onDismissActions: (msgId: string) => void;
  onExecuteActions: (msgId: string, actionsList: AiAction[]) => void;
}

export function ChatMessageItem({
  msg,
  notes,
  rawFolders,
  onOpenNote,
  onMessageClick,
  onConfirmDanger,
  onDismissActions,
  onExecuteActions,
}: ChatMessageItemProps) {
  const handleCopy = () => {
    void navigator.clipboard?.writeText(msg.text);
  };

  const isUser = msg.role === "user";

  return (
    <div className={`group flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm transition-all duration-200 ${
          isUser
            ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
            : msg.error
            ? "border border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-950/30 dark:bg-rose-950/10 dark:text-rose-400"
            : "border border-border/40 bg-surface-strong/70 text-foreground backdrop-blur-sm"
        }`}
      >
        {!isUser && !msg.error ? (
          <span
            onClick={onMessageClick}
            dangerouslySetInnerHTML={{
              __html: `<p>${renderMarkdown(msg.text)}</p>`,
            }}
          />
        ) : (
          <span>{msg.text}</span>
        )}

        {msg.streaming && (
          <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current opacity-70" />
        )}

        {!isUser && !msg.streaming && !msg.error && (
          <button
            className="absolute -right-8 top-2 hidden h-6 w-6 items-center justify-center rounded-lg text-foreground/40 hover:bg-background/60 hover:text-foreground active:scale-95 transition group-hover:flex"
            title="Скопировать"
            type="button"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {msg.citations && msg.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pr-8 items-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Источники:</span>
          {msg.citations.map((c) => (
            <button
              className="rounded-xl border border-violet-200 bg-violet-50/70 px-2.5 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100 hover:shadow-sm dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-950/40"
              key={c.id}
              type="button"
              onClick={() => onOpenNote?.(c.id)}
            >
              📄 {c.title}
            </button>
          ))}
        </div>
      )}

      {msg.actions && msg.actions.length > 0 && msg.actionsStatus && (
        <AgentActionCard
          msgId={msg.id}
          actions={msg.actions}
          actionsStatus={msg.actionsStatus}
          actionError={msg.actionError}
          confirmDanger={msg.confirmDanger}
          rawFolders={rawFolders}
          notes={notes}
          onConfirmDanger={onConfirmDanger}
          onDismissActions={onDismissActions}
          onExecuteActions={onExecuteActions}
        />
      )}
    </div>
  );
}
