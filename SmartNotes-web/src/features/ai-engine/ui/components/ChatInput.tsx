import { Send } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
}

export function ChatInput({ input, setInput, loading, inputRef, onSend }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/40 bg-surface-strong/70 p-3 backdrop-blur-md">
      <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-background/50 px-3 py-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 transition duration-200">
        <textarea
          ref={inputRef}
          className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-foreground/38 py-1"
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
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white transition disabled:opacity-40 hover:brightness-110 active:scale-95 shadow-md shadow-violet-600/10"
          disabled={!input.trim() || loading}
          type="button"
          onClick={onSend}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-foreground/32 font-bold tracking-wider uppercase">
        Enter — отправить · Shift+Enter — новая строка
      </p>
    </div>
  );
}
