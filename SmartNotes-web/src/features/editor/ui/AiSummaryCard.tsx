"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AiStatus } from "@/entities/note";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";

type AiSummaryCardProps = {
  summary: string | null | undefined;
  aiStatus: AiStatus;
};

export function AiSummaryCard({ summary, aiStatus }: AiSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";

  const isLoading = aiStatus === "pending" || aiStatus === "analyzing";
  const hasSummary = !!summary && !isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-cyan-500/10 p-[1px] shadow-lg shadow-violet-950/4 backdrop-blur-md"
    >
      <div className="rounded-[15px] bg-surface/90 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Sparkles className={`h-4 w-4 ${isLoading ? "animate-pulse" : ""}`} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.15em] text-foreground/80">
              {lang === "ru" ? "ИИ Анализ" : "AI Insight"}
            </span>
            {isLoading && (
              <span className="inline-flex items-center rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                Генерация...
              </span>
            )}
          </div>
          {hasSummary && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-strong transition-colors text-foreground/54"
              type="button"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/78">
                {isLoading ? (
                  <div className="space-y-2 py-1">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-foreground/6" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-foreground/6" />
                  </div>
                ) : hasSummary ? (
                  summary
                ) : (
                  <span className="italic text-foreground/42">
                    Добавьте больше текста в заметку, чтобы искусственный интеллект автоматически сформировал краткую сводку.
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
