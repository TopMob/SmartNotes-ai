import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  SeparatorHorizontal,
  Palette,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { ComponentType } from "react";

type EditorToolbarProps = {
  editor: Editor;
  setIsDrawing: (value: boolean) => void;
  handleAttachImage: () => Promise<void>;
  lang: string;
};

export function EditorToolbar({ editor, setIsDrawing, handleAttachImage, lang }: EditorToolbarProps) {
  return (
    <div className="sticky top-0 z-10 mt-4 flex flex-nowrap overflow-x-auto no-scrollbar scroll-smooth snap-x md:flex-wrap md:overflow-visible items-center gap-1.5 rounded-2xl border border-border bg-surface-strong/92 p-1.5 backdrop-blur-xl">
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton title={lang === "ru" ? "Жирный" : "Bold"} active={editor.isActive("bold")} icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton title={lang === "ru" ? "Курсив" : "Italic"} active={editor.isActive("italic")} icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton title={lang === "ru" ? "Подчеркнутый" : "Underline"} active={editor.isActive("underline")} icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolButton title={lang === "ru" ? "Зачеркнутый" : "Strikethrough"} active={editor.isActive("strike")} icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} />
      </div>
      
      <div className="h-6 w-px bg-border mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton title={lang === "ru" ? "Выровнять по левому краю" : "Align left"} active={editor.isActive({ textAlign: "left" })} icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
        <ToolButton title={lang === "ru" ? "Выровнять по центру" : "Align center"} active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
        <ToolButton title={lang === "ru" ? "Выровнять по правому краю" : "Align right"} active={editor.isActive({ textAlign: "right" })} icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
      </div>
      
      <div className="h-6 w-px bg-border mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton title={lang === "ru" ? "Маркированный список" : "Bullet list"} active={editor.isActive("bulletList")} icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton title={lang === "ru" ? "Нумерованный список" : "Ordered list"} active={editor.isActive("orderedList")} icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      </div>
      
      <div className="h-6 w-px bg-border mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton 
          title={lang === "ru" ? "Вставить ссылку" : "Insert link"} 
          active={editor.isActive("link")} 
          icon={Link2} 
          onClick={() => {
            const { from, to } = editor.state.selection;
            const isTextSelected = from !== to;
            if (isTextSelected) {
              const url = window.prompt(lang === "ru" ? "Ссылка" : "URL");
              if (url) {
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              }
            } else {
              const url = window.prompt(lang === "ru" ? "Ссылка" : "URL");
              if (url) {
                const text = window.prompt(lang === "ru" ? "Текст ссылки" : "Link text") || url;
                editor.chain().focus().insertContent(`<a href="${url}">${text}</a>`).run();
              }
            }
          }} 
        />
        <ToolButton title={lang === "ru" ? "Разделительная линия" : "Horizontal rule"} icon={SeparatorHorizontal} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </div>
      
      <div className="h-6 w-px bg-border mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton title={lang === "ru" ? "Рисовать" : "Draw"} icon={Palette} onClick={() => setIsDrawing(true)} />
        <ToolButton title={lang === "ru" ? "Добавить изображение" : "Add image"} icon={Image} onClick={() => void handleAttachImage()} />
      </div>
      
      <div className="h-6 w-px bg-border mx-1 shrink-0" />
      
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton title={lang === "ru" ? "Очистить форматирование" : "Clear formatting"} icon={Eraser} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
      </div>
    </div>
  );
}

export function ToolButton({ icon: Icon, label, title, active = false, onClick }: { icon?: ComponentType<{ className?: string }>; label?: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button 
      title={title} 
      className={`shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-background/80 ${
        active ? "bg-background text-accent" : "text-foreground/80"
      } h-11 w-11 md:h-9 md:w-9 touch-manipulation`} 
      onClick={onClick} 
      type="button"
    >
      {Icon ? <Icon className="h-5 w-5 md:h-4 md:w-4" /> : <span className="text-sm font-black">{label}</span>}
    </button>
  );
}
