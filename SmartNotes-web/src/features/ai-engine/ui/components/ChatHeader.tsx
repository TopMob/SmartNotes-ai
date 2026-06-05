import { getUiCopy } from "@/shared/lib/i18n";
import { RotateCcw, ChevronRight, X, Sparkles } from "lucide-react";

interface ChatHeaderProps {
  copy: ReturnType<typeof getUiCopy>;
  hasMessages: boolean;
  onClear: () => void;
  onClose: () => void;
}

export function ChatHeader({ copy, hasMessages, onClear, onClose }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-surface-strong/70 px-4 py-3 backdrop-blur-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black tracking-tight">{copy.ai.chatTitle}</p>
        <p className="truncate text-xs text-foreground/48 font-medium">
          {copy.ai.chatDescription}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {hasMessages && (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background/60 hover:text-foreground active:scale-95 transition"
            title={copy.ai.chatClearHistory}
            type="button"
            onClick={onClear}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background/60 hover:text-foreground active:scale-95 transition"
          title={copy.ai.chatClose}
          type="button"
          onClick={onClose}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/56 hover:bg-background/60 hover:text-foreground active:scale-95 transition"
          title={copy.ai.chatCloseAndClear}
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
