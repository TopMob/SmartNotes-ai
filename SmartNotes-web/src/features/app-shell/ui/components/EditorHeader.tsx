import { ChevronLeft, ChevronDown, Files, Share2, MoreHorizontal, Undo2, Redo2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { NotePage } from "@/entities/note";
import { AccessBadge } from "@/features/editor-collab/ui/access-badge";
import { getSheetAnchor, type SheetAnchor, type SheetName } from "./shared";

type EditorHeaderProps = {
  pages: NotePage[];
  currentNotePageIndex: number;
  setCurrentNotePageIndex: (index: number) => void;
  pageCount: number;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  addPage: () => void;
  role: string;
  editor: Editor;
  toolbarVisible: boolean;
  setToolbarVisible: (visible: boolean) => void;
  handleClose: () => void;
  lang: string;
};

export function EditorHeader({
  pages,
  currentNotePageIndex,
  setCurrentNotePageIndex,
  pageCount,
  onOpenSheet,
  addPage,
  role,
  editor,
  toolbarVisible,
  setToolbarVisible,
  handleClose,
  lang,
}: EditorHeaderProps) {
  return (
    <header className="mx-3 sm:mx-0 flex items-center gap-1 overflow-x-auto no-scrollbar rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8 sm:gap-2">
      <button title="Назад к списку заметок" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={handleClose} type="button"><ChevronLeft className="h-6 w-6 sm:h-5 sm:w-5" /></button>
      
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[50%] shrink-0">
        {pages.slice(0, 3).map((p, idx) => {
          const isActive = currentNotePageIndex === idx;
          return (
            <button
              key={p.id}
              onClick={() => setCurrentNotePageIndex(idx)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold shrink-0 transition-all border ${
                isActive 
                  ? "bg-accent/10 border-accent/20 text-accent font-black" 
                  : "bg-surface-strong/60 border-transparent hover:bg-background text-foreground/72"
              }`}
              type="button"
            >
              <span className="truncate max-w-[70px]" title={p.title}>{p.title}</span>
            </button>
          );
        })}
        {pageCount > 3 && (
          <button
            onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-strong/80 hover:bg-background border border-border px-2 text-xs font-black text-accent shrink-0 transition-all"
            type="button"
          >
            +{pageCount - 3}
          </button>
        )}
        {role !== "viewer" && pageCount < 10 && (
          <button
            onClick={() => {
              addPage();
              setCurrentNotePageIndex(pageCount);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-strong/40 hover:bg-background border border-dashed border-border shrink-0 text-foreground/45 hover:text-foreground transition-all"
            title={lang === "ru" ? "Добавить страницу" : "Add page"}
            type="button"
          >
            +
          </button>
        )}
      </div>

      <button title="Список страниц" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Files className="h-6 w-6 sm:h-5 sm:w-5" /></button>
      <AccessBadge role={role as "editor" | "owner" | "viewer"} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
         <button title="Отменить действие" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} type="button"><Undo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
        <button title="Повторить действие" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} type="button"><Redo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
        <button title="Поделиться заметкой" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("share", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Share2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
        <button title="Действия заметки" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-6 w-6 sm:h-5 sm:w-5" /></button>
         <button title="Панель форматирования" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-6 w-6 sm:h-5 sm:w-5" /></button>
      </div>
    </header>
  );
}
