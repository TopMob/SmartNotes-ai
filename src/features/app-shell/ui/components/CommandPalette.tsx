"use client";






import {
  Archive,
  BookOpen,
  FileText,
  Folder,
  Heart,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Note } from "@/entities/note";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { scoreSearchMatch } from "@/shared/lib/search";
import { useUiStore } from "@/shared/store/ui-store";
import Link from "next/link";





type ActionItem = {
  id: string;
  type: "action";
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  onSelect: () => void;
};

type NoteItem = {
  id: string;
  type: "note";
  note: Note;
};

type SectionItem = {
  id: string;
  type: "section";
  label: string;
};

type PaletteItem = ActionItem | NoteItem | SectionItem;

type CommandPaletteProps = {
  onOpenNote: (noteId: string) => void;
  onCreateNote: () => void;
};





function scoreNote(note: Note, query: string): number {
  return scoreSearchMatch(
    [
      { value: note.title, weight: 8 },
      { value: note.content, weight: 2 },
      { value: note.userTags.join(" "), weight: 5 },
    ],
    query,
  );
}





function NoteRow({ note, active, onSelect }: { note: Note; active: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const preview = note.content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return (
    <button
      ref={ref}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
        active ? "bg-accent/12 text-accent" : "hover:bg-surface-strong"
      }`}
      type="button"
      onClick={onSelect}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-accent/20" : "bg-surface-strong"}`}>
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{note.title || "Без названия"}</span>
        {preview && <span className="block truncate text-xs text-foreground/48">{preview}</span>}
      </span>
      {note.pinned && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
      {note.favorite && <Heart className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
      {note.lock && <Lock className="h-3.5 w-3.5 shrink-0 text-foreground/40" />}
    </button>
  );
}





function ActionRow({ item, active }: { item: ActionItem; active: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const Icon = item.icon;

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
        active ? "bg-accent/12 text-accent" : "hover:bg-surface-strong"
      }`}
      type="button"
      onClick={item.onSelect}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-accent/20" : "bg-surface-strong"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{item.label}</span>
        {item.description && <span className="block text-xs text-foreground/48">{item.description}</span>}
      </span>
      {item.shortcut && (
        <kbd className="shrink-0 rounded-lg border border-border bg-surface-strong px-2 py-0.5 text-[10px] font-bold text-foreground/48">
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}





export function CommandPalette({ onOpenNote, onCreateNote }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: allNotes = [] } = useNotesFlat();
  const toggleAiChat = useUiStore((s) => s.toggleAiChat);
  const setView = useUiStore((s) => s.setView);


  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);


  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);


  const actions = useMemo<ActionItem[]>(() => [
    {
      id: "new-note",
      type: "action",
      label: "Создать заметку",
      description: "Новая пустая заметка",
      icon: Plus,
      shortcut: "N",
      onSelect: () => { onCreateNote(); setOpen(false); },
    },
    {
      id: "ai-chat",
      type: "action",
      label: "AI по заметкам",
      description: "Открыть AI-чат",
      icon: Sparkles,
      shortcut: "A",
      onSelect: () => { toggleAiChat(); setOpen(false); },
    },
    {
      id: "favorites",
      type: "action",
      label: "Избранные заметки",
      icon: Heart,
      onSelect: () => { setView("favorites"); setOpen(false); },
    },
    {
      id: "archive",
      type: "action",
      label: "Архив",
      icon: Archive,
      onSelect: () => { setView("archive"); setOpen(false); },
    },
    {
      id: "folders",
      type: "action",
      label: "Папки",
      icon: Folder,
      onSelect: () => { setView("folders"); setOpen(false); },
    },
    {
      id: "locked",
      type: "action",
      label: "Заблокированные",
      icon: Lock,
      onSelect: () => { setView("locked"); setOpen(false); },
    },
    {
      id: "reminders",
      type: "action",
      label: "Напоминания",
      icon: BookOpen,
      onSelect: () => { setView("reminders"); setOpen(false); },
    },
    {
      id: "trash",
      type: "action",
      label: "Корзина",
      icon: Trash2,
      onSelect: () => { setView("trash"); setOpen(false); },
    },
    {
      id: "settings",
      type: "action",
      label: "Настройки",
      description: "Темы, редактор, данные",
      icon: Settings,
      shortcut: ",",
      onSelect: () => { setOpen(false); },

    },
    {
      id: "more",
      type: "action",
      label: "Диагностика",
      icon: MoreHorizontal,
      onSelect: () => { setView("admin_tools"); setOpen(false); },
    },
  ], [onCreateNote, setView, toggleAiChat]);


  const matchedNotes = useMemo(() => {
    const q = query.trim();
    if (!q) return allNotes.filter((n) => !n.trashedAt).slice(0, 6);
    return allNotes
      .filter((n) => !n.trashedAt && scoreNote(n, q) > 0)
      .sort((a, b) => scoreNote(b, query) - scoreNote(a, query))
      .slice(0, 8);
  }, [query, allNotes]);


  const matchedActions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q),
    );
  }, [query, actions]);


  const selectables = useMemo<Array<{ kind: "note"; note: Note } | { kind: "action"; action: ActionItem }>>(() => {
    const items: Array<{ kind: "note"; note: Note } | { kind: "action"; action: ActionItem }> = [];
    if (matchedNotes.length) matchedNotes.forEach((n) => items.push({ kind: "note", note: n }));
    if (matchedActions.length) matchedActions.forEach((a) => items.push({ kind: "action", action: a }));
    return items;
  }, [matchedNotes, matchedActions]);


  const selectCurrent = useCallback(() => {
    const item = selectables[activeIndex];
    if (!item) return;
    if (item.kind === "note") { onOpenNote(item.note.id); setOpen(false); }
    else { item.action.onSelect(); }
  }, [selectables, activeIndex, onOpenNote]);


  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectables.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectCurrent();
    }
  }


  useEffect(() => { setActiveIndex(0); }, [query]);

  const noteOffset = 0;
  const actionOffset = matchedNotes.length;

  return (
    <>
      {/* Keyboard hint in sidebar / header — invisible trigger, shortcut visible via tooltip */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
            />

            {/* Palette modal */}
            <motion.div
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="fixed inset-x-4 top-[10vh] z-[61] mx-auto max-w-[640px]"
              exit={{ scale: 0.96, opacity: 0, y: -8 }}
              initial={{ scale: 0.96, opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            >
              <div className="overflow-hidden rounded-[1.8rem] border border-border bg-surface shadow-2xl shadow-black/40 backdrop-blur-2xl">
                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Search className="h-5 w-5 shrink-0 text-foreground/40" />
                  <input
                    ref={inputRef}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/36"
                    id="command-palette-input"
                    placeholder="Поиск заметок и команд…"
                    spellCheck={false}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                  />
                  {query && (
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/8 text-foreground/48 hover:bg-foreground/14"
                      type="button"
                      onClick={() => setQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <kbd className="hidden shrink-0 rounded-lg border border-border bg-surface-strong px-2 py-0.5 text-[10px] font-bold text-foreground/36 sm:block">
                    Esc
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[60vh] overflow-y-auto p-2">

                  {/* Notes section */}
                  {matchedNotes.length > 0 && (
                    <>
                      <p className="mb-1 mt-1 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/36">
                        {query ? "Заметки" : "Недавние"}
                      </p>
                      {matchedNotes.map((note, i) => (
                        <NoteRow
                          key={note.id}
                          active={noteOffset + i === activeIndex}
                          note={note}
                          onSelect={() => { onOpenNote(note.id); setOpen(false); }}
                        />
                      ))}
                    </>
                  )}

                  {/* Actions section */}
                  {matchedActions.length > 0 && (
                    <>
                      <p className="mb-1 mt-3 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/36">
                        Действия
                      </p>
                      {matchedActions.map((action, i) =>
                        action.id === "settings" ? (
                          <Link
                            key={action.id}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                              actionOffset + i === activeIndex ? "bg-accent/12 text-accent" : "hover:bg-surface-strong"
                            }`}
                            href="/settings"
                            onClick={() => setOpen(false)}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${actionOffset + i === activeIndex ? "bg-accent/20" : "bg-surface-strong"}`}>
                              <Settings className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">{action.label}</span>
                              {action.description && <span className="block text-xs text-foreground/48">{action.description}</span>}
                            </span>
                            <kbd className="shrink-0 rounded-lg border border-border bg-surface-strong px-2 py-0.5 text-[10px] font-bold text-foreground/48">
                              ,
                            </kbd>
                          </Link>
                        ) : (
                          <ActionRow
                            key={action.id}
                            item={action}
                            active={actionOffset + i === activeIndex}
                          />
                        )
                      )}
                    </>
                  )}

                  {/* Empty state */}
                  {matchedNotes.length === 0 && matchedActions.length === 0 && (
                    <div className="py-10 text-center text-sm text-foreground/42">
                      Ничего не найдено по «{query}»
                    </div>
                  )}

                  {/* Bottom hint */}
                  <div className="mt-2 flex items-center justify-center gap-4 border-t border-border px-4 py-2.5 text-[10px] text-foreground/32">
                    <span><kbd className="font-bold">↑↓</kbd> навигация</span>
                    <span><kbd className="font-bold">Enter</kbd> выбрать</span>
                    <span><kbd className="font-bold">Esc</kbd> закрыть</span>
                    <span className="hidden sm:inline"><kbd className="font-bold">⌘K</kbd> открыть/закрыть</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
