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
  Redo2,
  Save,
  Share2,
  Strikethrough,
  Tag,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { MathExtension } from "@/features/editor/lib/math-extension";
import { DrawingCanvas } from "@/features/editor/ui/DrawingCanvas";
import { useAiEngineStore } from "@/features/ai-engine/model/ai-store";
import { useAutoAnalyze } from "@/features/ai-engine/hooks/use-auto-analyze";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { Note } from "@/entities/note";
import { useNoteCollabPage } from "@/features/editor-collab/hooks/use-note-collab-page";
import { useDurableNoteSave } from "@/features/editor-collab/hooks/use-durable-note-save";
import { useNoteCollabSession } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useNoteTitleTags } from "@/features/editor-collab/hooks/use-note-title-tags";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { uploadMediaFile } from "@/features/notes/lib/media-import";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { setMediaDiagnostic } from "@/services/diagnostics/runtime-diagnostics";
import { Button } from "@/shared/ui/button";
import { AccessBadge } from "@/features/editor-collab/ui/access-badge";
import { useAuthStore } from "@/features/auth/model/auth-store";

import { getSheetAnchor, plainTextToEditorContent, serializeEditorSnapshot, type SheetAnchor, type SheetName } from "./shared";

const EDITOR_EXTENSIONS = [
  StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  UnderlineExtension,
  ImageExtension,
  MathExtension,
];

type EditorOverlayProps = {
  note: Note;
  onClose: () => void;
  onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  toolbarVisible: boolean;
  setToolbarVisible: (visible: boolean) => void;
};

export function EditorOverlay({ note, onClose, onOpenSheet, toolbarVisible, setToolbarVisible }: EditorOverlayProps) {
  const { attachMedia, deletePage } = useNoteActions();
  const currentNotePageIndex = useNoteUiStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNoteUiStore((state) => state.setCurrentNotePageIndex);
  const { status, durableState } = useNoteCollabSession();
  const user = useAuthStore((state) => state.user);
  const isOwner = note.ownerId === user?.id || user?.id === "local-user";
  const userAccess = note.access?.find(a => a.userId === user?.id);
  const role = isOwner ? "owner" : (userAccess?.role ?? "viewer");

  const { page: currentPage, pageCount, addPage: _addPage, removePage, setPageContent } = useNoteCollabPage(currentNotePageIndex);
  const { title, userTags, setTitle, setUserTags } = useNoteTitleTags();
  const snapshotRef = useRef(serializeEditorSnapshot(note));
  const editorDirty = useNoteUiStore((state) => state.editorDirty);
  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);
  const aiStatus = useAiEngineStore((state) => state.status);
  useAutoAnalyze(note.id, currentPage.content);
  const [isDrawing, setIsDrawing] = useState(false);

  const tagString = userTags.join(", ");
  const [tagsInput, setTagsInput] = useState(tagString);

  useEffect(() => {
    setTagsInput(tagString);
  }, [tagString]);

  useDurableNoteSave();

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: plainTextToEditorContent(currentPage.content),
    immediatelyRender: false,
    editable: role !== "viewer",
    onUpdate: ({ editor: tiptapEditor }) => {
      setPageContent(currentPage.id, tiptapEditor.getHTML());
      markEditorDirty(true);
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(role !== "viewer");
    }
  }, [editor, role]);

  useEffect(() => {
    if (currentNotePageIndex > pageCount - 1) {
      setCurrentNotePageIndex(Math.max(0, pageCount - 1));
    }
  }, [currentNotePageIndex, pageCount, setCurrentNotePageIndex]);

  useEffect(() => {
    snapshotRef.current = serializeEditorSnapshot(note);
    markEditorDirty(false);
    setCurrentNotePageIndex(0);
  }, [markEditorDirty, note.id, setCurrentNotePageIndex]);


  const lastPageIdRef = useRef(currentPage.id);
  useEffect(() => {
    if (currentPage.id !== lastPageIdRef.current) {
      lastPageIdRef.current = currentPage.id;
      editor?.commands.setContent(plainTextToEditorContent(currentPage.content), { emitUpdate: false });
    }
  }, [currentPage.id, currentPage.content, editor]);

  useEffect(() => {
    markEditorDirty(durableState.hasUnsavedChanges);
  }, [durableState.hasUnsavedChanges, markEditorDirty]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markEditorDirty, onClose]);

  function handleClose() {
    onClose();
  }

  function handleDeletePage() {
    if (pageCount <= 1) return;
    if (!window.confirm("Удалить текущую страницу? Это действие необратимо.")) return;

    const pageId = currentPage.id;


    removePage(pageId);


    deletePage(note.id, pageId);


    if (currentNotePageIndex >= pageCount - 1) {
      setCurrentNotePageIndex(Math.max(0, currentNotePageIndex - 1));
    }
  }

  function handleTitleChange(value: string) {
    if (role === "viewer") return;
    setTitle(value);
    markEditorDirty(true);
  }

  function handleTagsBlur(value: string) {
    if (role === "viewer") return;
    const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    setUserTags(tags);
    markEditorDirty(true);
  }

  async function handleAttachImage() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";

    picker.onchange = async () => {
      const file = picker.files?.[0];

      if (!file) {
        return;
      }

      try {
        const media = await uploadMediaFile(file, note.id);
        attachMedia(note.id, media);
        if (media.url) editor?.chain().focus().setImage({ src: media.url }).run();
        setMediaDiagnostic({
          provider: media.provider,
          degraded: media.provider === "local-inline",
          message: media.provider === "local-inline"
            ? `Stored ${file.name} as local inline media because direct Drive upload is not configured in this client build.`
            : `Uploaded ${file.name} successfully to Google Drive via proxy.`,
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Не удалось добавить изображение.");
      }
    };

    picker.click();
  }

  if (!editor) {
    return null;
  }

  if (status === "hydrating") {
    return (
      <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-center px-3 py-3 sm:px-5">
          <div className="rounded-[2rem] border border-border bg-surface/88 px-6 py-5 text-sm font-bold text-foreground/64 shadow-2xl shadow-violet-950/8">Подготавливаем локальную сессию заметки...</div>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3 sm:px-5">
        <header className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8 sm:gap-2">
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={handleClose} type="button"><ChevronLeft className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-surface-strong px-2 py-1 text-sm font-black">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex === 0} onClick={() => setCurrentNotePageIndex(Math.max(0, currentNotePageIndex - 1))} type="button"><ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" /></button>
            <span className="px-1">{currentNotePageIndex + 1}/{pageCount}</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex >= pageCount - 1} onClick={() => setCurrentNotePageIndex(Math.min(pageCount - 1, currentNotePageIndex + 1))} type="button"><ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" /></button>
            <button
              aria-label="Удалить страницу"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-background disabled:opacity-35"
              disabled={pageCount <= 1 || role === "viewer"}
              onClick={handleDeletePage}
              title="Удалить страницу"
              type="button"
            >
              <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </div>
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Folder className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          <AccessBadge role={role} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
             <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} type="button"><Undo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} type="button"><Redo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("share", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Share2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          </div>
        </header>

        <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 sm:p-8">
           <input disabled={role === "viewer"} className="w-full bg-transparent text-2xl font-black tracking-tight outline-none placeholder:text-foreground/28 sm:text-4xl" onChange={(event) => handleTitleChange(event.target.value)} placeholder="Заголовок" value={(title === "Untitled note" || title === "Untitled Note" ? "" : title) || ""} />
          {isDrawing && (
            <DrawingCanvas
              onClose={() => setIsDrawing(false)}
              onSave={(dataUrl) => {
                editor.chain().focus().setImage({ src: dataUrl }).run();
                setIsDrawing(false);
              }}
            />
          )}
           {toolbarVisible && role !== "viewer" ? (
            <div className="sticky top-0 z-10 mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar overflow-y-hidden rounded-2xl border border-border bg-surface-strong/92 p-1.5 backdrop-blur-xl">
              <ToolButton active={editor.isActive("bold")} icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
              <ToolButton active={editor.isActive("italic")} icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
              <ToolButton active={editor.isActive("underline")} icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
              <ToolButton active={editor.isActive("strike")} icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} />
              <ToolButton active={editor.isActive({ textAlign: "left" })} icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
              <ToolButton active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
              <ToolButton active={editor.isActive({ textAlign: "right" })} icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
              <ToolButton active={editor.isActive("bulletList")} icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <ToolButton label="1." active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
              <ToolButton label="HR" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
              <ToolButton label="Clear" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
              <ToolButton active={editor.isActive("link")} label="Link" onClick={() => { const url = window.prompt("Ссылка"); if (url) { editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); } }} />
              <ToolButton icon={Paintbrush} label="Sketch" onClick={() => setIsDrawing(true)} />
              <ToolButton icon={FileImage} label="Add image" onClick={() => void handleAttachImage()} />
            </div>
          ) : null}
          <div 
            className="mt-5 flex min-h-[60vh] flex-1 rounded-[1.5rem] border border-border bg-background/36 p-4 text-lg leading-9 outline-none cursor-text focus-within:ring-2 focus-within:ring-accent/25 focus-within:border-accent/80 transition-all"
            onClick={() => editor.chain().focus().run()}
          >
            <div className="min-h-full flex-1 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[55vh]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        <footer className="mt-3 flex flex-col gap-2 rounded-[1.5rem] border border-border bg-surface/92 p-3 shadow-xl shadow-violet-950/8 sm:flex-row sm:items-center sm:p-2">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-surface-strong px-3 sm:min-h-11">
            <Tag className="h-5 w-5 text-accent sm:h-4 sm:w-4" />
            <input 
              disabled={role === "viewer"}
              className="min-w-0 flex-1 bg-transparent outline-none" 
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              onBlur={() => handleTagsBlur(tagsInput)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleTagsBlur(tagsInput);
                  event.currentTarget.blur();
                }
              }}
              placeholder="tag1, tag2" 
            />
          </label>
          <div className="flex w-full items-center justify-between sm:w-auto sm:gap-2">
            <div className="flex flex-col gap-0.5 sm:gap-2 sm:flex-row">
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/48 sm:text-xs">
                AI: {aiStatus === 'pending' ? 'Ожидание' : aiStatus === 'analyzing' ? 'Анализ...' : aiStatus === 'error' ? 'Ошибка AI' : 'Готово'}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/48 sm:text-xs">{durableState.error ? "Ошибка" : durableState.isSaving ? "Сохранение..." : editorDirty ? "Несохранено" : "Синхронизировано"}</div>
            </div>
            <Button className="h-11 shrink-0 rounded-2xl px-6 font-bold" onClick={handleClose} type="button"><Save className="mr-2 h-5 w-5" />Готово</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active = false, onClick }: { icon?: ComponentType<{ className?: string }>; label?: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-black hover:bg-background sm:px-3 sm:py-2 ${active ? "bg-background text-accent" : ""}`} onClick={onClick} type="button">
      {Icon ? <Icon className="h-5 w-5 sm:h-4 sm:w-4" /> : label}
    </button>
  );
}
