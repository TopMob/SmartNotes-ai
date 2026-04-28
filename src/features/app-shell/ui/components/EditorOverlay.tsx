import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Folder,
  Italic,
  List,
  MoreHorizontal,
  Paintbrush,
  Save,
  Share2,
  Strikethrough,
  Tag,
  Underline,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type ComponentType } from "react";

import type { Note } from "@/entities/note";
import { attachMedia, addPage, patchNote, updatePage } from "@/features/notes/model/note-actions";
import { useNotesStore } from "@/features/notes/model/notes-store";
import { Button } from "@/shared/ui/button";

import { getSheetAnchor, plainTextToEditorContent, serializeEditorSnapshot, type SheetAnchor, type SheetName } from "./shared";

type EditorOverlayProps = {
  note: Note;
  onClose: () => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  toolbarVisible: boolean;
  setToolbarVisible: (visible: boolean) => void;
};

export function EditorOverlay({ note, onClose, onOpenSheet, toolbarVisible, setToolbarVisible }: EditorOverlayProps) {
  const currentNotePageIndex = useNotesStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNotesStore((state) => state.setCurrentNotePageIndex);
  const snapshotRef = useRef(serializeEditorSnapshot(note));
  const currentPage = note.pages[currentNotePageIndex] ?? note.pages[0];
  const editorDirty = useNotesStore((state) => state.editorDirty);
  const markEditorDirty = useNotesStore((state) => state.markEditorDirty);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false } }),
      LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: plainTextToEditorContent(currentPage.content),
    immediatelyRender: false,
    onUpdate: ({ editor: tiptapEditor }) => {
      const nextContent = tiptapEditor.getHTML();
      updatePage(note.id, currentPage.id, { content: nextContent });
      markEditorDirty(
        serializeEditorSnapshot({
          ...note,
          content: nextContent,
          pages: note.pages.map((page) => (page.id === currentPage.id ? { ...page, content: nextContent } : page)),
        }) !== snapshotRef.current,
      );
    },
  });

  useEffect(() => {
    if (currentNotePageIndex > note.pages.length - 1) {
      setCurrentNotePageIndex(Math.max(0, note.pages.length - 1));
    }
  }, [currentNotePageIndex, note.pages.length, setCurrentNotePageIndex]);

  useEffect(() => {
    snapshotRef.current = serializeEditorSnapshot(note);
    markEditorDirty(false);
    setCurrentNotePageIndex(0);
  }, [markEditorDirty, note.id, setCurrentNotePageIndex]);

  useEffect(() => {
    editor?.commands.setContent(plainTextToEditorContent(currentPage.content), { emitUpdate: false });
  }, [currentPage.content, currentPage.id, editor]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markEditorDirty, onClose]);

  function syncDirtyState(nextSnapshot: string) {
    markEditorDirty(nextSnapshot !== snapshotRef.current);
  }

  function handleClose() {
    syncDirtyState(serializeEditorSnapshot(note));
    onClose();
  }

  function handleTitleChange(value: string) {
    const nextTitle = value || currentPage.title || "Untitled note";
    void patchNote(note.id, { title: nextTitle }, { scheduleAnalysis: false });
    syncDirtyState(
      serializeEditorSnapshot({
        ...note,
        title: nextTitle,
      }),
    );
  }

  function handleTagsBlur(value: string) {
    const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    void patchNote(note.id, { userTags: tags }, { scheduleAnalysis: false });
    syncDirtyState(
      serializeEditorSnapshot({
        ...note,
        userTags: tags,
      }),
    );
  }

  if (!editor) {
    return null;
  }

  if (!currentPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3 sm:px-5">
        <header className="flex items-center gap-1 rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8 sm:gap-2">
          <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={handleClose} type="button"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-1 rounded-2xl bg-surface-strong px-2 py-1 text-sm font-black">
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex === 0} onClick={() => setCurrentNotePageIndex(Math.max(0, currentNotePageIndex - 1))} type="button"><ChevronLeft className="h-4 w-4" /></button>
            {currentNotePageIndex + 1}/{note.pages.length}
            <button className="rounded-lg p-1 hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex >= note.pages.length - 1} onClick={() => setCurrentNotePageIndex(Math.min(note.pages.length - 1, currentNotePageIndex + 1))} type="button"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Folder className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-1">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" type="button"><Undo2 className="h-5 w-5" /></button>
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" type="button"><Share2 className="h-5 w-5" /></button>
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-5 w-5" /></button>
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-5 w-5" /></button>
          </div>
        </header>

        <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 sm:p-8">
          <input className="w-full bg-transparent text-2xl font-black tracking-tight outline-none placeholder:text-foreground/28 sm:text-4xl" onChange={(event) => handleTitleChange(event.target.value)} placeholder="Заголовок" value={note.title} />
          {toolbarVisible ? (
            <div className="sticky top-0 z-10 mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-surface-strong/92 p-1.5 backdrop-blur-xl">
              <ToolButton active={editor.isActive("bold")} icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
              <ToolButton active={editor.isActive("italic")} icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
              <ToolButton active={editor.isActive("underline")} icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
              <ToolButton active={editor.isActive("strike")} icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} />
              <ToolButton active={editor.isActive({ textAlign: "left" })} icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
              <ToolButton active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
              <ToolButton active={editor.isActive({ textAlign: "right" })} icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
              <ToolButton active={editor.isActive("bulletList")} icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <ToolButton active={editor.isActive("link")} label="Link" onClick={() => { const url = window.prompt("Ссылка"); if (url) { editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); } }} />
              <ToolButton icon={Paintbrush} label="Sketch" onClick={() => { addPage(note.id, `Sketch ${note.pages.length + 1}`); setCurrentNotePageIndex(note.pages.length); }} />
              <ToolButton icon={FileImage} label="Add image" onClick={() => { const url = window.prompt("Ссылка на изображение"); if (!url) return; attachMedia(note.id, { id: `media_${Date.now().toString(36)}`, provider: "google-drive", fileId: url, url, mimeType: "image/*", name: "Image", size: 0, thumbnailUrl: url }); }} />
            </div>
          ) : null}
          <div className="mt-5 flex min-h-[60vh] flex-1 rounded-[1.5rem] border border-border bg-background/36 p-4 text-lg leading-9 outline-none" onMouseDown={() => editor.chain().focus().run()}>
            <div className="min-h-full flex-1" onMouseDown={() => editor.chain().focus().run()}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        <footer className="mt-3 flex items-center gap-2 rounded-[1.5rem] border border-border bg-surface/92 p-2 shadow-xl shadow-violet-950/8">
          <label className="flex min-h-9 flex-1 items-center gap-2 rounded-2xl bg-surface-strong px-3 sm:min-h-11"><Tag className="h-4 w-4 text-accent" /><input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={note.userTags.join(", ")} onBlur={(event) => handleTagsBlur(event.target.value)} placeholder="tag1, tag2" /></label>
          <div className="text-xs font-bold text-foreground/48">{editorDirty ? "Есть несохраненные локальные изменения" : "Все изменения в локальном state"}</div>
          <Button className="h-10 rounded-2xl sm:h-11" onClick={handleClose} type="button"><Save className="mr-2 h-4 w-4" />Готово</Button>
        </footer>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active = false, onClick }: { icon?: ComponentType<{ className?: string }>; label?: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-black hover:bg-background sm:px-3 sm:py-2 sm:text-sm ${active ? "bg-background text-accent" : ""}`} onClick={onClick} type="button">
      {Icon ? <Icon className="h-4 w-4" /> : label}
    </button>
  );
}
