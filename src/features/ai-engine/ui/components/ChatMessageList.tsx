import { Bot } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import type { AiAction } from "@/features/ai-engine/model/agent-actions";
import { ChatMessageItem } from "./ChatMessageItem";
import type { Message } from "../../hooks/use-ai-chat";

interface ChatMessageListProps {
  messages: Message[];
  notes: Note[];
  rawFolders: FolderEntity[];
  loading: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onOpenNote?: (noteId: string) => void;
  onMessageClick: (e: React.MouseEvent<HTMLSpanElement>) => void;
  onConfirmDanger: (msgId: string) => void;
  onDismissActions: (msgId: string) => void;
  onExecuteActions: (msgId: string, actionsList: AiAction[]) => void;
}

const QUICK_PROMPTS = [
  "Что я знаю о React?",
  "Мои задачи на эту неделю",
  "Идеи для проектов",
  "Заметки по дизайну",
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

export function ChatMessageList({
  messages,
  notes,
  rawFolders,
  loading,
  bottomRef,
  onSend,
  onOpenNote,
  onMessageClick,
  onConfirmDanger,
  onDismissActions,
  onExecuteActions,
}: ChatMessageListProps) {
  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-thin">
      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-tr from-violet-600/15 to-indigo-600/15 text-violet-600 dark:text-violet-400 border border-violet-500/10 shadow-inner"
          >
            <Bot className="h-8 w-8 animate-bounce" />
          </motion.span>
          <div>
            <h3 className="text-sm font-black tracking-tight">Твой AI-гид по заметкам</h3>
            <p className="mt-1.5 text-xs text-foreground/54 max-w-[260px] leading-relaxed font-medium">
              Задай вопрос — найду ответ в твоих заметках
            </p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid w-full gap-2.5 mt-2"
          >
            {QUICK_PROMPTS.map((hint) => (
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.02, translateY: -1 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-2xl border border-border/40 bg-surface-strong/70 px-4 py-3 text-left text-sm font-black text-foreground/70 transition-all hover:border-violet-400/40 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-indigo-50/50 hover:text-violet-700 dark:hover:from-violet-950/20 dark:hover:to-indigo-950/20 dark:hover:text-violet-400 shadow-sm"
                key={hint}
                type="button"
                onClick={() => onSend(hint)}
              >
                {hint}
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          msg={msg}
          notes={notes}
          rawFolders={rawFolders}
          onOpenNote={onOpenNote}
          onMessageClick={onMessageClick}
          onConfirmDanger={onConfirmDanger}
          onDismissActions={onDismissActions}
          onExecuteActions={onExecuteActions}
        />
      ))}

      {loading && !messages.some((m) => m.streaming) && (
        <div className="flex items-start animate-pulse">
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-surface-strong/70 px-4 py-3 text-sm text-foreground/54 shadow-sm backdrop-blur-sm">
            <div className="flex space-x-1 items-center justify-center">
              <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600" />
            </div>
            <span className="font-bold text-xs tracking-wide">AI думает…</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
