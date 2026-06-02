"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useUiStore } from "@/shared/store/ui-store";
import type { Note } from "@/entities/note";
import { useAiChat } from "../hooks/use-ai-chat";
import { ChatHeader } from "./components/ChatHeader";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatInput } from "./components/ChatInput";

type AiChatPanelProps = {
  onOpenNote?: (noteId: string) => void;
  activeNote?: Note | null;
};

export function AiChatPanel({ onOpenNote, activeNote }: AiChatPanelProps) {
  const open = useUiStore((s) => s.aiChatOpen);
  const setAiChatOpen = useUiStore((s) => s.setAiChatOpen);

  const {
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
  } = useAiChat({ activeNote, onOpenNote, open });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setAiChatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setAiChatOpen]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs lg:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setAiChatOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            animate={{ x: 0, opacity: 1 }}
            aria-label="AI чат по заметкам"
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-border/40 bg-surface-strong/85 shadow-2xl shadow-violet-950/10 backdrop-blur-xl sm:w-[420px] transition-colors duration-300"
            exit={{ x: "100%", opacity: 0 }}
            id="ai-chat-panel"
            initial={{ x: "100%", opacity: 0 }}
            role="complementary"
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
            style={{ willChange: "transform, opacity" }}
          >
            <ChatHeader
              hasMessages={messages.length > 0}
              onClear={handleClear}
              onClose={() => setAiChatOpen(false)}
            />

            <ChatMessageList
              messages={messages}
              notes={notes}
              rawFolders={rawFolders}
              loading={loading}
              bottomRef={bottomRef}
              onSend={(text) => void handleSend(text)}
              onOpenNote={onOpenNote}
              onMessageClick={handleMessageClick}
              onConfirmDanger={handleConfirmDanger}
              onDismissActions={handleDismissActions}
              onExecuteActions={handleExecuteActions}
            />

            <ChatInput
              input={input}
              setInput={setInput}
              loading={loading}
              inputRef={inputRef}
              onSend={() => void handleSend()}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
