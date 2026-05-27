import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Palette,
  Redo2,
  Save,
  Share2,
  Strikethrough,
  Tag,
  Trash2,
  Underline,
  Undo2,
  Sparkles,
  Cloud,
  CloudOff,
  Loader2,
  Check,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { DrawingCanvas } from "@/features/editor/ui/DrawingCanvas";
import { useAiEngineStore } from "@/features/ai-engine/model/ai-store";
import { useAutoAnalyze } from "@/features/ai-engine/hooks/use-auto-analyze";
import { useEffect, useRef, useState, useCallback, useMemo, type ComponentType } from "react";

import type { Note } from "@/entities/note";
import { useNoteCollabPage } from "@/features/editor-collab/hooks/use-note-collab-page";
import { useDurableNoteSave } from "@/features/editor-collab/hooks/use-durable-note-save";
import { useNoteCollabSession } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useNoteTitleTags } from "@/features/editor-collab/hooks/use-note-title-tags";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { uploadMediaFile } from "@/features/notes/lib/media-import";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { getUiCopy } from "@/shared/lib/i18n";
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

  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);

  // Scroll Position Memory
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const saved = localStorage.getItem(`scroll_${note.id}_${currentNotePageIndex}`);
    if (saved) {
      container.scrollTop = parseInt(saved, 10);
    } else {
      container.scrollTop = 0;
    }
  }, [note.id, currentNotePageIndex, status]);

  const { page: currentPage, pageCount, addPage: _addPage, removePage, setPageContent } = useNoteCollabPage(currentNotePageIndex);
  const { title, userTags, setTitle, setUserTags } = useNoteTitleTags();
  const snapshotRef = useRef(serializeEditorSnapshot(note));
  const editorDirty = useNoteUiStore((state) => state.editorDirty);
  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);
  const aiStatus = useAiEngineStore((state) => state.status);
  useAutoAnalyze(note, currentPage.content);
  const [isDrawing, setIsDrawing] = useState(false);
  const isHydratedRef = useRef(false);

  const [tagDraftVal, setTagDraftVal] = useState("");
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const { data: allNotes = [] } = useNotesFlat();

  const allExistingTags = useMemo(() => {
    const tagsSet = new Set<string>();
    allNotes.forEach((n) => {
      if (n.userTags) {
        n.userTags.forEach((t) => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }, [allNotes]);

  const lastTagTyped = tagDraftVal.trim();

  const tagSuggestions = useMemo(() => {
    if (!lastTagTyped) return [];
    return allExistingTags.filter(
      (tag) =>
        tag.toLowerCase().startsWith(lastTagTyped.toLowerCase()) &&
        !userTags.includes(tag)
    );
  }, [lastTagTyped, allExistingTags, userTags]);

  const selectTagSuggestion = useCallback((suggestion: string) => {
    if (role === "viewer") return;
    if (!userTags.includes(suggestion)) {
      const next = [...userTags, suggestion];
      setUserTags(next);
      markEditorDirty(true);
    }
    setTagDraftVal("");
  }, [role, userTags, setUserTags, markEditorDirty]);

  const handleTagInputBlur = useCallback(() => {
    setTimeout(() => setTagInputFocused(false), 250);
    if (role === "viewer") return;
    const trimmed = tagDraftVal.trim().replace(/^#/, "");
    if (trimmed) {
      if (!userTags.includes(trimmed)) {
        const next = [...userTags, trimmed];
        setUserTags(next);
        markEditorDirty(true);
      }
      setTagDraftVal("");
    }
  }, [role, tagDraftVal, userTags, setUserTags, markEditorDirty]);

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (role === "viewer") return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = tagDraftVal.trim().replace(/^#/, "");
      if (trimmed) {
        if (!userTags.includes(trimmed)) {
          const next = [...userTags, trimmed];
          setUserTags(next);
          markEditorDirty(true);
        }
        setTagDraftVal("");
      }
    } else if (e.key === "Backspace" && !tagDraftVal && userTags.length > 0) {
      const next = userTags.slice(0, -1);
      setUserTags(next);
      markEditorDirty(true);
    }
  }, [role, tagDraftVal, userTags, setUserTags, markEditorDirty]);

  const { flush } = useDurableNoteSave();

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: plainTextToEditorContent(currentPage.content),
    immediatelyRender: false,
    editable: role !== "viewer",
    onUpdate: ({ editor: tiptapEditor }) => {
      if (status !== "ready" || !isHydratedRef.current) {
        return;
      }
      setPageContent(currentPage.id, tiptapEditor.getHTML());
      markEditorDirty(true);
    },
    editorProps: {
      transformPastedHTML(html) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          doc.querySelectorAll("script, iframe, object, embed, link, style").forEach((el) => el.remove());
          doc.querySelectorAll("*").forEach((el) => {
            for (let i = 0; i < el.attributes.length; i++) {
              const attr = el.attributes[i];
              if (attr.name.startsWith("on")) {
                el.removeAttribute(attr.name);
              }
            }
          });
          return doc.body.innerHTML;
        } catch (e) {
          console.error("Paste sanitization error:", e);
          return html;
        }
      }
    }
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
    isHydratedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markEditorDirty, note.id, setCurrentNotePageIndex]);


  const lastPageIdRef = useRef(currentPage.id);
  useEffect(() => {
    if (status !== "ready" || !editor) return;

    if (!isHydratedRef.current || currentPage.id !== lastPageIdRef.current) {
      isHydratedRef.current = true;
      lastPageIdRef.current = currentPage.id;
      editor.commands.setContent(plainTextToEditorContent(currentPage.content), { emitUpdate: false });
    }
  }, [status, currentPage.id, currentPage.content, editor]);

  useEffect(() => {
    markEditorDirty(durableState.hasUnsavedChanges);
  }, [durableState.hasUnsavedChanges, markEditorDirty]);

  const handleClose = useCallback(async () => {
    await flush();
    onClose();
  }, [flush, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  function handleDeletePage() {
    if (pageCount <= 1) return;
    if (!window.confirm(copy?.shell?.dialogs?.pageDeleteConfirm || "Удалить страницу? Это действие необратимо.")) return;

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

  async function handleAttachImage() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";

    picker.onchange = async () => {
      const file = picker.files?.[0];

      if (!file) {
        return;
      }

      // Create a temporary object URL for instant local preview
      const localUrl = URL.createObjectURL(file);

      // Insert image immediately
      if (editor) {
        editor.chain().focus().setImage({ src: localUrl }).run();
      }

      const googleAuthUser = user as unknown as {
        app_metadata?: { provider?: string };
        identities?: Array<{ provider: string }>;
      } | null;
      const isGoogleUser = googleAuthUser?.app_metadata?.provider === "google" || googleAuthUser?.identities?.some((i) => i.provider === "google") || false;

      try {
        const media = await uploadMediaFile(file, note.id, isGoogleUser);
        attachMedia(note.id, media);

        // Replace optimistic preview with actual uploaded URL
        if (media.url && editor) {
          let replaced = false;
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "image" && node.attrs.src === localUrl) {
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: media.url,
                })
              );
              replaced = true;
              return false; // stop iteration
            }
          });

          if (!replaced) {
            editor.chain().focus().setImage({ src: media.url }).run();
          }
        }

        setMediaDiagnostic({
          provider: media.provider,
          degraded: media.provider === "local-inline",
          message: media.provider === "local-inline"
            ? `Stored ${file.name} as local inline media because direct Drive upload is not configured in this client build.`
            : `Uploaded ${file.name} successfully to Google Drive via proxy.`,
        });
      } catch (error) {
        // Remove optimistic image preview on failure
        if (editor) {
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "image" && node.attrs.src === localUrl) {
              editor.view.dispatch(
                editor.state.tr.delete(pos, pos + node.nodeSize)
              );
              return false; // stop iteration
            }
          });
        }
        window.alert(error instanceof Error ? error.message : "Не удалось добавить изображение.");
      } finally {
        URL.revokeObjectURL(localUrl);
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
          <div className="rounded-[2rem] border border-border bg-surface/88 px-6 py-5 text-sm font-bold text-foreground/64 shadow-2xl shadow-violet-950/8">{lang === "ru" ? "Подготавливаем локальную сессию заметки..." : "Preparing local note session..."}</div>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-0 py-2 sm:px-5 sm:py-3">
        <header className="mx-3 sm:mx-0 flex items-center gap-1 overflow-x-auto no-scrollbar rounded-[1.5rem] border border-border bg-surface/90 p-2 shadow-xl shadow-violet-950/8 sm:gap-2">
          <button title="Назад к списку заметок" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={handleClose} type="button"><ChevronLeft className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-surface-strong px-2 py-1 text-sm font-black">
            <button title="Предыдущая страница" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex === 0} onClick={() => setCurrentNotePageIndex(Math.max(0, currentNotePageIndex - 1))} type="button"><ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" /></button>
            <span className="px-1">{currentNotePageIndex + 1}/{pageCount}</span>
            <button title="Следующая страница" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background disabled:opacity-35" disabled={currentNotePageIndex >= pageCount - 1} onClick={() => setCurrentNotePageIndex(Math.min(pageCount - 1, currentNotePageIndex + 1))} type="button"><ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" /></button>
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
          <button title="Список страниц" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("pages", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><BookOpen className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          <AccessBadge role={role} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
             <button title="Отменить действие" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} type="button"><Undo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button title="Повторить действие" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong disabled:opacity-35 sm:h-10 sm:w-10" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} type="button"><Redo2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button title="Поделиться заметкой" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("share", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><Share2 className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button title="Действия заметки" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={(event) => onOpenSheet("note", getSheetAnchor(event.currentTarget.getBoundingClientRect()))} type="button"><MoreHorizontal className="h-6 w-6 sm:h-5 sm:w-5" /></button>
            <button title="Панель форматирования" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-surface-strong sm:h-10 sm:w-10" onClick={() => setToolbarVisible(!toolbarVisible)} type="button"><ChevronDown className="h-6 w-6 sm:h-5 sm:w-5" /></button>
          </div>
        </header>

        <section
          ref={scrollContainerRef}
          onScroll={(e) => {
            localStorage.setItem(`scroll_${note.id}_${currentNotePageIndex}`, String(e.currentTarget.scrollTop));
          }}
          className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-none sm:rounded-[2rem] border-x-0 sm:border border-border bg-surface/88 p-2 sm:p-8 shadow-none sm:shadow-2xl shadow-violet-950/8"
        >
           <input 
             disabled={role === "viewer"} 
             className="w-full rounded-2xl border border-border bg-surface-strong/60 px-4 py-3 text-2xl font-black tracking-tight outline-none focus:border-accent/80 focus:ring-2 focus:ring-accent/25 transition-all placeholder:text-foreground/28 sm:text-4xl disabled:opacity-60" 
             onChange={(event) => handleTitleChange(event.target.value)} 
             placeholder={lang === "ru" ? "Заголовок" : "Title"} 
             value={(title === "Untitled note" || title === "Untitled Note" ? "" : title) || ""} 
           />
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
            <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface-strong/92 p-1.5 backdrop-blur-xl">
              {/* Group 1: Text formatting */}
              <div className="flex items-center gap-1">
                <ToolButton title={lang === "ru" ? "Жирный" : "Bold"} active={editor.isActive("bold")} icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
                <ToolButton title={lang === "ru" ? "Курсив" : "Italic"} active={editor.isActive("italic")} icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
                <ToolButton title={lang === "ru" ? "Подчеркнутый" : "Underline"} active={editor.isActive("underline")} icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
                <ToolButton title={lang === "ru" ? "Зачеркнутый" : "Strikethrough"} active={editor.isActive("strike")} icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} />
              </div>
              
              <div className="h-6 w-px bg-border mx-1 shrink-0" />
              
              {/* Group 2: Alignment */}
              <div className="flex items-center gap-1">
                <ToolButton title={lang === "ru" ? "Выровнять по левому краю" : "Align left"} active={editor.isActive({ textAlign: "left" })} icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
                <ToolButton title={lang === "ru" ? "Выровнять по центру" : "Align center"} active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
                <ToolButton title={lang === "ru" ? "Выровнять по правому краю" : "Align right"} active={editor.isActive({ textAlign: "right" })} icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
              </div>
              
              <div className="h-6 w-px bg-border mx-1 shrink-0" />
              
              {/* Group 3: Lists */}
              <div className="flex items-center gap-1">
                <ToolButton title={lang === "ru" ? "Маркированный список" : "Bullet list"} active={editor.isActive("bulletList")} icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                <ToolButton title={lang === "ru" ? "Нумерованный список" : "Ordered list"} active={editor.isActive("orderedList")} icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
              </div>
              
              <div className="h-6 w-px bg-border mx-1 shrink-0" />
              
              {/* Group 4: Links & Elements */}
              <div className="flex items-center gap-1">
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
                <ToolButton title={lang === "ru" ? "Разделительная линия" : "Horizontal rule"} icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
              </div>
              
              <div className="h-6 w-px bg-border mx-1 shrink-0" />
              
              {/* Group 5: Drawing & Media */}
              <div className="flex items-center gap-1">
                <ToolButton title={lang === "ru" ? "Рисовать" : "Draw"} icon={Palette} onClick={() => setIsDrawing(true)} />
                <ToolButton title={lang === "ru" ? "Добавить изображение" : "Add image"} icon={Image} onClick={() => void handleAttachImage()} />
              </div>
              
              <div className="h-6 w-px bg-border mx-1 shrink-0" />
              
              {/* Group 6: Clean Formatting */}
              <div className="flex items-center gap-1">
                <ToolButton title={lang === "ru" ? "Очистить форматирование" : "Clear formatting"} icon={Eraser} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
              </div>
            </div>
          ) : null}
          <div 
            className="mt-4 sm:mt-5 flex min-h-[60vh] flex-1 rounded-none sm:rounded-[1.5rem] border-0 sm:border border-border bg-transparent sm:bg-background/36 p-1 sm:p-5 mx-0 text-lg leading-9 outline-none cursor-text focus-within:ring-0 sm:focus-within:ring-2 sm:focus-within:ring-accent/25 sm:focus-within:border-accent/80 transition-all"
            onClick={() => editor.chain().focus().run()}
          >
            <div className="min-h-full flex-1 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[55vh]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        <footer className="mx-3 sm:mx-0 mt-3 flex flex-col gap-3 rounded-[1.5rem] border border-border bg-surface/92 p-3 shadow-xl shadow-violet-950/8 sm:flex-row sm:items-center sm:p-2">
          <div className="relative flex-1">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-strong px-3 py-1.5 border border-border min-h-11">
              <Tag className="h-4 w-4 text-accent shrink-0" />
              {userTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1 text-xs font-bold text-accent">
                  #{tag}
                  {role !== "viewer" && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const nextTags = userTags.filter((t) => t !== tag);
                        setUserTags(nextTags);
                        markEditorDirty(true);
                      }} 
                      className="hover:text-foreground text-accent/60 transition-colors text-sm font-black"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
              <input 
                disabled={role === "viewer"}
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none py-1 text-foreground placeholder:text-foreground/32" 
                value={tagDraftVal}
                onChange={(event) => setTagDraftVal(event.target.value)}
                onFocus={() => setTagInputFocused(true)}
                onBlur={handleTagInputBlur}
                onKeyDown={handleTagInputKeyDown}
                placeholder={userTags.length === 0 ? (lang === "ru" ? "Добавить тег..." : "Add tag...") : ""} 
              />
            </div>
            {tagInputFocused && tagSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 max-h-40 w-full overflow-y-auto rounded-2xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-2xl z-50">
                <div className="flex flex-wrap gap-1.5">
                  {tagSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectTagSuggestion(suggestion);
                      }}
                      className="rounded-lg bg-surface-strong px-2.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-accent/15 hover:text-accent transition-colors"
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex w-full items-center justify-between sm:w-auto sm:gap-4">
            <div className="flex items-center gap-2">
              {/* AI Badge */}
              {aiStatus === "analyzing" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-bold text-violet-500 border border-violet-500/20 animate-pulse">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>{lang === "ru" ? "AI Анализ..." : "AI Analyzing..."}</span>
                </span>
              )}
              {aiStatus === "pending" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 border border-amber-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{lang === "ru" ? "AI Ожидание" : "AI Pending"}</span>
                </span>
              )}
              {aiStatus === "done" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                  <Check className="h-3.5 w-3.5" />
                  <span>{lang === "ru" ? "AI Готово" : "AI Analyzed"}</span>
                </span>
              )}
              {aiStatus === "error" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 border border-rose-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                  <span>{lang === "ru" ? "Ошибка AI" : "AI Error"}</span>
                </span>
              )}

              {/* Sync / Saving Badge */}
              {durableState.error ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 border border-rose-500/20">
                  <CloudOff className="h-3.5 w-3.5" />
                  <span>{lang === "ru" ? "Ошибка сохранения" : "Sync Error"}</span>
                </span>
              ) : durableState.isSaving ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-500 border border-blue-500/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{lang === "ru" ? "Сохранение..." : "Saving..."}</span>
                </span>
              ) : editorDirty ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 border border-amber-500/20 animate-pulse">
                  <Cloud className="h-3.5 w-3.5" />
                  <span>{lang === "ru" ? "Несохранено" : "Unsaved"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                  <Cloud className="h-3.5 w-3.5" />
                  <span>{lang === "ru" ? "Синхронизировано" : "Synced"}</span>
                </span>
              )}
            </div>
            <Button className="h-11 shrink-0 rounded-2xl px-6 font-bold" onClick={handleClose} type="button"><Save className="mr-2 h-5 w-5" />{copy.shell.actions.saveDone || "Done"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, title, active = false, onClick }: { icon?: ComponentType<{ className?: string }>; label?: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button title={title} className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-black hover:bg-background sm:px-3 sm:py-2 ${active ? "bg-background text-accent" : ""}`} onClick={onClick} type="button">
      {Icon ? <Icon className="h-5 w-5 sm:h-4 sm:w-4" /> : label}
    </button>
  );
}
