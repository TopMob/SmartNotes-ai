"use client";

import { Loader2, Send, Star, X } from "lucide-react";
import { useState } from "react";

import { submitFeedback } from "../api/feedback-api";
import { useAuthStore } from "@/features/auth/model/auth-store";

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const user = useAuthStore((s) => s.user);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setErrorMessage("Пожалуйста, выберите оценку.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      await submitFeedback({
        rating,
        feedback,
        diagnostics: [
           { type: "auth", email: user?.email }
        ],
        systemLanguage: navigator.language,
        userAgent: navigator.userAgent,
      });
      setStatus("success");
      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setStatus("idle");
          setRating(0);
          setFeedback("");
        }, 500);
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Не удалось отправить отзыв");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
        onClick={status !== "submitting" ? onClose : undefined} 
      />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-surface-strong p-6 shadow-2xl shadow-violet-950/20 animate-in fade-in zoom-in-95 duration-200">
        <button
          className="absolute right-4 top-4 rounded-full p-2 text-foreground/50 transition hover:bg-background hover:text-foreground"
          onClick={onClose}
          disabled={status === "submitting"}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-black tracking-tight text-foreground">Обратная связь</h2>
        <p className="mt-2 text-sm text-foreground/60">
          Помогите нам стать лучше! Оцените приложение и расскажите, чего вам не хватает.
        </p>

        {status === "success" ? (
          <div className="mt-8 flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 mb-4">
              <Send className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-foreground">Спасибо!</h3>
            <p className="mt-2 text-sm text-foreground/60">Ваш отзыв успешно отправлен.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-foreground/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">
                {rating === 0 ? "Выберите оценку" : rating === 5 ? "Отлично!" : rating >= 3 ? "Хорошо" : "Могло быть лучше"}
              </span>
            </div>

            <div className="space-y-2">
              <textarea
                className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                placeholder="Что вам понравилось? Что стоит улучшить?"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={status === "submitting"}
              />
              {errorMessage && (
                <p className="text-xs font-bold text-rose-500 animate-in slide-in-from-top-1">{errorMessage}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === "submitting" || rating === 0}
              className="group relative flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 overflow-hidden"
            >
              {status === "submitting" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="relative z-10">Отправить отзыв</span>
                  <Send className="h-4 w-4 relative z-10 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
