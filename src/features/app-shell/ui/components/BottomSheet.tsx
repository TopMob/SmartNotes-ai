import { Pencil, Star, X, Copy, Users, FolderOpen, Bell, Archive, Lock, Unlock, Download, Trash2, Eye, EyeOff, FileText, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNoteCollabPage } from "@/features/editor-collab/hooks/use-note-collab-page";
import { useNoteCollabSession } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { LockModal } from "@/features/lock-center/ui/lock-modal";
import { useLockStore } from "@/features/lock-center/model/lock-store";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { publish } from "@/services/event-bus";
import { requestNotificationPermission } from "@/services/notifications/notification-service";
import { scheduleReminder } from "@/services/reminders/reminder-service";
import { getConsoleLogs } from "@/services/console-log-store";
import { getUiCopy } from "@/shared/lib/i18n";
import { Button } from "@/shared/ui/button";
import { SharePrompt } from "@/features/editor-collab/ui/share-prompt";
import { AiSummaryCard } from "@/features/editor/ui/AiSummaryCard";
import { verifyNoteLock } from "@/features/lock-center/lib/lock-service";
import { useAiEngineStore } from "@/features/ai-engine/model/ai-store";
import { collabRepository } from "@/features/editor-collab/api/collab-repository";

import { exportNoteAsPdf, exportNoteAsTxt, exportNoteAsPng, exportNoteForImport, getNotePlainText, type SheetState, type SheetAnchor, type SheetName } from "./shared";

type BottomSheetProps = {
  sheet: SheetState;
  activeFolder: FolderEntity | null;
  editorDirty: boolean;
  isDesktop: boolean;
  onClose: () => void;
  onCloseWithoutClear?: () => void;
  onOpenSheet?: (name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
  onOpenEditor?: () => void;
  onCloseEditor?: () => void;
};

export function BottomSheet({ sheet, activeFolder, isDesktop, onClose, onCloseWithoutClear, onOpenSheet, onOpenEditor, onCloseEditor }: BottomSheetProps) {
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);

  if (!sheet) {
    return null;
  }

  const { name, anchor } = sheet;
  const title =
    name === "folder"
      ? copy.shell.folder
      : name === "note"
        ? copy.shell.noteActions
        : name === "pages"
          ? copy.shell.pages
          : name === "lock"
            ? copy.shell.lockCenter
            : name === "create-folder"
              ? copy.shell.createFolderSheet
              : name === "reminder"
                ? copy.shell.reminder
                : name === "share"
                  ? copy.shell.actions.share
                  : name === "invites"
                    ? (lang === "ru" ? "Приглашения совместного доступа" : "Collaboration Invites")
                    : copy.shell.aboutSheet;
  const topSheet = name === "pages";
  const mobileSheet = !isDesktop;
  const folderPopup = name === "folder" && !!anchor && !mobileSheet;

  function renderSheetContent() {
    const isPositioned = !(name === "note" || name === "about" || name === "share" || mobileSheet || !anchor);
    const animationClass = isPositioned
      ? "animate-premium-backdrop"
      : (name === "note" || name === "about" || name === "share") && !mobileSheet
        ? "animate-premium-modal"
        : "animate-premium-sheet";

    return (
      <section
        className={`absolute border border-border bg-surface p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl ${mobileSheet ? "inset-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[2rem]" : name === "note" || name === "about" || name === "share" ? "left-1/2 top-1/2 w-[min(92vw,32rem)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem]" : anchor ? "w-[min(92vw,24rem)] max-h-[82vh] overflow-y-auto rounded-[1.8rem]" : topSheet ? "inset-x-0 top-0 max-h-[86vh] overflow-y-auto rounded-b-[2rem] lg:left-1/2 lg:top-4 lg:w-[min(94vw,48rem)] lg:-translate-x-1/2 lg:rounded-[2rem]" : "inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[2rem] lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-[2rem]"} ${animationClass}`}
        style={isPositioned ? { left: `${anchor.x}px`, top: `${anchor.y}px`, transform: `translate(-50%, ${anchor.placement === "above" ? "-100%" : "0"})` } : undefined}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-xl font-black">{title}</h2>
          <button className="rounded-full p-2 hover:bg-surface-strong" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        {name === "folder" ? <FolderActionList copy={copy} activeFolder={activeFolder} onClose={onClose} /> : null}
        {name === "note" ? <NoteActionSheet copy={copy} onOpenSheet={onOpenSheet} onClose={onClose} onCloseEditor={onCloseEditor} /> : null}
        {name === "pages" ? <PagesContent copy={copy} /> : null}
        {name === "lock" ? <LockContent copy={copy} onClose={onCloseWithoutClear || onClose} onOpenEditor={onOpenEditor} /> : null}
        {name === "about" ? <AboutContent copy={copy} /> : null}
        {name === "create-folder" ? <CreateFolderContent copy={copy} onClose={onClose} /> : null}
        {name === "reminder" ? <ReminderContent copy={copy} onClose={onClose} /> : null}
        {name === "share" ? <ShareContent onClose={onClose} /> : null}
        {name === "invites" ? <InvitesContent copy={copy} /> : null}
      </section>
    );
  }

  return folderPopup ? (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <button aria-label="Закрыть меню" className="absolute inset-0 pointer-events-auto bg-transparent" onClick={onClose} type="button" />
      <div className="pointer-events-auto absolute left-0 top-0">{renderSheetContent()}</div>
    </div>
  ) : (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-md animate-premium-backdrop" onClick={onClose} type="button" />
      {renderSheetContent()}
    </div>
  );
}

function getLockPassword(promptText: string, errorEmpty: string) {
  const value = window.prompt(promptText);

  if (value === null) {
    return null;
  }

  const password = value.trim();

  if (!password) {
    window.alert(errorEmpty);
    return null;
  }

  return password;
}

async function copyNoteText(note: Note) {
  const text = getNotePlainText(note);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function NoteActionSheet({ copy, onOpenSheet, onClose, onCloseEditor }: { copy: ReturnType<typeof getUiCopy>; onOpenSheet?: (name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; onClose: () => void; onCloseEditor?: () => void }) {
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const { data: notes = [] } = useNotesFlat();
  const { data: folders = [] } = useFoldersQuery();
  const { moveNoteToFolder, patchNote, restoreNote, permanentlyDeleteNote, setArchived, setReminder, trashNote } = useNoteActions();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  const aiStatus = useAiEngineStore((state) => state.status);
  const dlgs = copy.shell.dialogs;
  const [lockModalOpen, setLockModalOpen] = useState(false);

  if (!currentNoteId || !note) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 pb-6">
      <AiSummaryCard summary={note.metadata?.summary as string | undefined} aiStatus={aiStatus} />
      
      {note.trashedAt ? (
        <div className="grid gap-2 grid-cols-2">
          <button className="min-h-12 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm font-bold hover:bg-background text-center transition" onClick={async () => { await restoreNote(note.id); onClose(); }} type="button">
            {copy.shell.actions.restore}
          </button>
          <button className="min-h-12 rounded-2xl border border-rose-200 bg-rose-500/6 text-rose-600 hover:bg-rose-500/10 px-4 py-3 text-sm font-bold text-center transition" onClick={async () => { await permanentlyDeleteNote(note.id); onClose(); onCloseEditor?.(); }} type="button">
            {copy.shell.actions.permanentDelete}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <GridActionBtn
            icon={Copy}
            label={dlgs?.copyText || "Копировать"}
            onClick={() => void copyNoteText(note)}
          />
          <GridActionBtn
            icon={Users}
            label={lang === "ru" ? "Доступ" : "Access"}
            onClick={() => onOpenSheet?.("share", null)}
          />
          <GridActionBtn
            icon={FolderOpen}
            label={lang === "ru" ? "Папка" : "Folder"}
            onClick={() => setFolderPickerOpen((value) => !value)}
            active={folderPickerOpen}
          />
          <GridActionBtn
            icon={Bell}
            label={lang === "ru" ? "Напомнить" : "Remind"}
            onClick={() => {
              if (onOpenSheet) {
                onOpenSheet("reminder", null);
              }
            }}
            active={!!note.reminderAt}
          />
          <GridActionBtn
            icon={Archive}
            label={note.isArchived ? (lang === "ru" ? "Вернуть" : "Restore") : (lang === "ru" ? "В архив" : "Archive")}
            onClick={() => void setArchived(note.id, !note.isArchived)}
            active={note.isArchived}
          />
          <GridActionBtn
            icon={note.lock ? Unlock : Lock}
            label={note.lock ? (lang === "ru" ? "Снять защиту" : "Remove Lock") : (lang === "ru" ? "Защитить" : "Lock")}
            onClick={() => setLockModalOpen(true)}
            active={!!note.lock}
          />
          <GridActionBtn
            icon={Download}
            label={lang === "ru" ? "Экспорт" : "Export"}
            onClick={() => setExportOpen((value) => !value)}
            active={exportOpen}
          />
          <GridActionBtn
            icon={Trash2}
            label={copy.shell.actions.delete || "Удалить"}
            onClick={async () => {
              await trashNote(note.id);
              onClose();
              onCloseEditor?.();
            }}
            destructive
          />
        </div>
      )}

      {exportOpen && !note.trashedAt && (
        <div className="rounded-[1.5rem] border border-border bg-surface-strong p-3.5 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">
            {lang === "ru" ? "Варианты экспорта" : "Export options"}
          </div>
          <div className="grid gap-2 grid-cols-2">
            <button className="flex items-center gap-2 rounded-xl bg-background border border-border p-2.5 text-xs font-bold hover:bg-surface-strong text-left" onClick={() => exportNoteAsTxt(note)} type="button">
              📄 {lang === "ru" ? "Скачать TXT" : "Download TXT"}
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-background border border-border p-2.5 text-xs font-bold hover:bg-surface-strong text-left" onClick={() => exportNoteAsPdf(note)} type="button">
              📕 {lang === "ru" ? "Экспорт в PDF" : "Export PDF"}
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-background border border-border p-2.5 text-xs font-bold hover:bg-surface-strong text-left" onClick={() => exportNoteAsPng(note)} type="button">
              🖼️ {lang === "ru" ? "Скачать PNG" : "Download PNG"}
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-background border border-border p-2.5 text-xs font-bold hover:bg-surface-strong text-left" onClick={() => exportNoteForImport(note)} type="button">
              💾 {lang === "ru" ? "Экспорт в JSON" : "JSON (Export)"}
            </button>
          </div>
        </div>
      )}

      {folderPickerOpen && !note.trashedAt && (
        <div className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-foreground/42">{copy.shell.folders}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionCard active={note.folderId === null} label={copy.shell.prompts.emptyFolder || "Без папки"} onClick={() => { void moveNoteToFolder(note.id, null); setFolderPickerOpen(false); onClose(); }} />
            {visibleFolders.map((folder) => (
              <ActionCard active={note.folderId === folder.id} key={folder.id} label={folder.name} onClick={() => { void moveNoteToFolder(note.id, folder.id); setFolderPickerOpen(false); onClose(); }} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[1.5rem] border border-border bg-surface-strong p-3 flex items-center justify-between text-sm font-bold text-foreground/72">
        <span>{dlgs?.yourAccess || "Ваш доступ:"}</span>
        <span className="rounded-lg bg-background border border-border px-3 py-1 text-xs text-accent">
          {note.ownerId === "local-user" || !note.access || note.access.length === 0
            ? (lang === "ru" ? "Владелец" : "Owner")
            : note.access[0].role === "owner"
              ? (lang === "ru" ? "Владелец" : "Owner")
              : note.access[0].role === "editor"
                ? (lang === "ru" ? "Редактор" : "Editor")
                : (lang === "ru" ? "Читатель" : "Reader")}
        </span>
      </div>

      <LockModal note={note} isOpen={lockModalOpen} onClose={(success) => {
        setLockModalOpen(false);
        if (success === true) {
          onClose();
        }
      }} />
    </div>
  );
}

function GridActionBtn({ 
  icon: Icon, 
  label, 
  onClick, 
  active = false, 
  destructive = false 
}: { 
  icon: LucideIcon; 
  label: string; 
  onClick: () => void; 
  active?: boolean; 
  destructive?: boolean; 
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`flex flex-col items-center justify-center rounded-2xl border p-2 text-center transition-all min-h-[76px] ${
        destructive 
          ? "border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10" 
          : active 
            ? "border-accent bg-accent/10 text-accent" 
            : "border-border bg-surface-strong hover:bg-background text-foreground/80 hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5 mb-1 shrink-0" />
      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-[1.15] line-clamp-2 text-center break-words max-w-full min-h-[2.3em] flex items-center justify-center">
        {label}
      </span>
    </button>
  );
}

function ActionCard({ label, onClick, active = false, destructive = false }: { label: string; onClick: () => void; active?: boolean; destructive?: boolean }) {
  return (
    <button className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition sm:min-h-11 ${active ? "border-accent bg-accent/15 text-accent font-black shadow-md shadow-accent/10" : destructive ? "border-rose-200 bg-rose-500/6 text-rose-600 hover:bg-rose-500/10" : "border-border bg-surface-strong hover:bg-background text-foreground/80 hover:text-foreground"}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function FolderActionList({ copy, activeFolder, onClose }: { copy: ReturnType<typeof getUiCopy>; activeFolder: FolderEntity | null; onClose: () => void }) {
  const { hideFolder, renameFolder, trashFolder, unhideFolder, updateFolderDescription } = useFolderActions();

  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(activeFolder?.name ?? "");
  const [descVal, setDescVal] = useState(activeFolder?.description ?? "");
  const [isCopied, setIsCopied] = useState(false);

  if (!activeFolder) {
    return null;
  }

  const folder = activeFolder;
  const dlgs = copy.shell.dialogs;

  function handleSaveRename() {
    const nextName = nameVal.trim();
    if (nextName) {
      void renameFolder(folder.id, nextName);
      setIsRenaming(false);
    }
  }

  function handleSaveDesc() {
    const nextDesc = descVal.trim() || null;
    void updateFolderDescription(folder.id, nextDesc);
    setIsEditingDesc(false);
  }

  function handleDelete() {
    const confirmMsg = (dlgs?.folderDeleteConfirm || "Удалить папку «{name}»?").replace("{name}", folder.name);
    if (!window.confirm(confirmMsg)) {
      return;
    }

    void trashFolder(folder.id);
    onClose();
  }

  async function handleShare() {
    const text = `${folder.name}\n${folder.description ?? ""}\nFolder ID: ${folder.id}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } else {
          throw new Error("Fallback copy failed");
        }
      }
    } catch (e) {
      console.error(e);
      setIsCopied(false);
      window.alert("Не удалось скопировать автоматически. Скопируйте вручную:\n\n" + text);
    }
  }

  return (
    <div className="mt-4 space-y-1">
      {isRenaming ? (
        <div className="p-3.5 rounded-2xl border border-border bg-surface-strong/50 space-y-3 animate-premium-sheet">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/42">Переименовать папку</div>
          <input 
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent text-foreground"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="Имя папки"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
          />
          <div className="flex gap-2">
            <Button className="flex-1 h-9 rounded-xl text-xs font-black" onClick={handleSaveRename}>Сохранить</Button>
            <Button className="h-9 rounded-xl text-xs font-bold" variant="secondary" onClick={() => setIsRenaming(false)}>Отмена</Button>
          </div>
        </div>
      ) : isEditingDesc ? (
        <div className="p-3.5 rounded-2xl border border-border bg-surface-strong/50 space-y-3 animate-premium-sheet">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/42">Изменить описание</div>
          <textarea 
            className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent text-foreground resize-none"
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            placeholder="Описание папки"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveDesc();
              }
              if (e.key === "Escape") setIsEditingDesc(false);
            }}
          />
          <div className="flex gap-2">
            <Button className="flex-1 h-9 rounded-xl text-xs font-black" onClick={handleSaveDesc}>Сохранить</Button>
            <Button className="h-9 rounded-xl text-xs font-bold" variant="secondary" onClick={() => setIsEditingDesc(false)}>Отмена</Button>
          </div>
        </div>
      ) : (
        <>
          {/* Block 1: Info & Management */}
          <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold hover:bg-surface-strong transition-all" onClick={() => setIsRenaming(true)} type="button">
            <Pencil className="h-4 w-4 text-foreground/64" />
            {copy.shell.actions.rename}
          </button>
          <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold hover:bg-surface-strong transition-all" onClick={() => setIsEditingDesc(true)} type="button">
            <FileText className="h-4 w-4 text-foreground/64" />
            {dlgs?.folderDescriptionPrompt || "Изменить описание"}
          </button>
          <div className="h-px bg-border my-2" />

          {folder.isHidden ? (
            <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold hover:bg-surface-strong transition-all" onClick={() => void unhideFolder(folder.id)} type="button">
              <Eye className="h-4 w-4 text-foreground/64" />
              {copy.shell.actions.unhide}
            </button>
          ) : (
            <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold hover:bg-surface-strong transition-all" onClick={() => void hideFolder(folder.id)} type="button">
              <EyeOff className="h-4 w-4 text-foreground/64" />
              {copy.shell.actions.hide}
            </button>
          )}

          <div className="h-px bg-border my-2" />

          {/* Block 3: Access & Sharing */}
          <button 
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold transition-all ${
              isCopied 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "hover:bg-surface-strong"
            }`} 
            onClick={handleShare} 
            type="button"
          >
            <Users className={`h-4 w-4 ${isCopied ? "text-emerald-400" : "text-foreground/64"}`} />
            <span>{isCopied ? "Скопировано в буфер! ✓" : copy.shell.actions.share}</span>
          </button>

          <div className="h-px bg-border my-2" />

          {/* Block 4: Destruction */}
          <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-all" onClick={handleDelete} type="button">
            <Trash2 className="h-4 w-4 text-rose-500" />
            {copy.shell.actions.delete}
          </button>
        </>
      )}
    </div>
  );
}

function PagesContent({ copy }: { copy: ReturnType<typeof getUiCopy> }) {
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const currentNotePageIndex = useNoteUiStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNoteUiStore((state) => state.setCurrentNotePageIndex);
  const { noteId } = useNoteCollabSession();
  const { pages, addPage, removePage: removeCollabPage, setPageTitle } = useNoteCollabPage(currentNotePageIndex);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageNameVal, setPageNameVal] = useState("");

  if (!currentNoteId || currentNoteId !== noteId) {
    return null;
  }

  const dlgs = copy.shell.dialogs;

  function handleStartRename(pageId: string, currentTitle: string) {
    setEditingPageId(pageId);
    setPageNameVal(currentTitle);
  }

  function handleSaveRename(pageId: string) {
    const nextTitle = pageNameVal.trim();
    if (nextTitle) {
      setPageTitle(pageId, nextTitle);
    }
    setEditingPageId(null);
  }

  function removePage(pageId: string) {
    if (!window.confirm(dlgs?.pageDeleteConfirm || "Удалить страницу?")) {
      return;
    }

    removeCollabPage(pageId);
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2">
        {pages.map((page, index) => {
          const isEditing = editingPageId === page.id;
          return (
            <div className={`flex flex-col gap-2 rounded-2xl p-3 transition ${currentNotePageIndex === index ? "bg-accent/10 text-accent" : "bg-surface-strong hover:bg-background"}`} key={page.id}>
              {isEditing ? (
                <div className="flex flex-col gap-2 w-full animate-premium-sheet">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/42">Переименовать страницу</div>
                  <input
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent text-foreground"
                    value={pageNameVal}
                    onChange={(e) => setPageNameVal(e.target.value)}
                    placeholder="Название страницы"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(page.id);
                      if (e.key === "Escape") setEditingPageId(null);
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button className="h-8 rounded-xl text-xs font-black px-3" onClick={() => handleSaveRename(page.id)}>Сохранить</Button>
                    <Button className="h-8 rounded-xl text-xs font-bold px-3" variant="secondary" onClick={() => setEditingPageId(null)}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setCurrentNotePageIndex(index)} type="button">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-sm font-black text-accent">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{page.title}</span>
                  </button>
                  <button className="rounded-xl p-2 text-foreground/60 hover:bg-background" onClick={() => handleStartRename(page.id, page.title)} type="button"><Pencil className="h-4 w-4" /></button>
                  {pages.length > 1 ? (
                    <button 
                      className="rounded-xl p-2 text-rose-500 hover:bg-background hover:text-rose-600 transition" 
                      onClick={() => removePage(page.id)} 
                      type="button"
                      title={copy.shell.actions.removePage || "Удалить"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Button className="w-full rounded-2xl" onClick={() => currentNoteId ? addPage() : null} type="button" variant="secondary">{copy.shell.actions.addPage || "Добавить страницу"}</Button>
    </div>
  );
}

function LockContent({ copy, onClose, onOpenEditor }: { copy: ReturnType<typeof getUiCopy>; onClose: () => void; onOpenEditor?: () => void }) {
  const { data: notes = [] } = useNotesFlat();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;

  if (!currentNoteId || !note?.lock) {
    return null;
  }

  const currentLock = note.lock;
  const dlgs = copy.shell.dialogs;

  async function handleUnlock() {
    const valid = await verifyNoteLock(currentLock, password);

    if (!valid) {
      setError(dlgs?.lockAlertIncorrect || "Неверный пароль");
      return;
    }

    useLockStore.getState().unlockNote(currentNoteId!);
    setError(null);
    setPassword("");
    onClose();
    onOpenEditor?.();
  }

  return <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-foreground/58">{dlgs?.lockDescription || "Контент заметки скрыт до локальной verify-проверки. Preview уже замаскирован в карточке."}</p><input type="text" style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} autoComplete="off" className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" name={`lock_${currentNoteId.slice(0, 6)}`} onChange={(event) => setPassword(event.target.value)} placeholder={dlgs?.lockEnterPassword || "Пароль заметки"} value={password} />{error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}<Button className="h-10 w-full rounded-2xl sm:h-11" onClick={() => void handleUnlock()} type="button">{dlgs?.lockButton || "Unlock"}</Button></div>;
}

function AboutContent({ copy }: { copy: ReturnType<typeof getUiCopy> }) {
  const [tab, setTab] = useState<"about" | "rate">("about");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const dlgs = copy.shell.dialogs;

  const developers = [
    { name: "Александров Арсений", role: "QA Tester" },
    { name: "Малышев Егор", role: "UI/UX Designer" },
    { name: "Миняев Иван", role: "Full-Stack Developer" },
    { name: "Копаев Иван", role: "Product Manager & Chief Visionary Officer (CVO)" },
  ];

  function handleFeedbackSubmit() {
    publish("feedbackSubmitted", {
      rating,
      feedback,
      diagnostics: getConsoleLogs(),
      systemLanguage: navigator.language,
      userAgent: navigator.userAgent,
    });
    window.alert(dlgs?.feedbackSent || "Спасибо за обратную связь!");
    setFeedback("");
  }

  return (
    <div className="mt-5 grid gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-border bg-surface-strong p-2">
        <button className={`rounded-xl px-4 py-3 text-sm font-black transition ${tab === "about" ? "bg-background text-accent" : "text-foreground/72 hover:bg-background/70"}`} onClick={() => setTab("about")} type="button">{copy.shell.aboutSheet || "О нас"}</button>
        <button className={`rounded-xl px-4 py-3 text-sm font-black transition ${tab === "rate" ? "bg-background text-accent" : "text-foreground/72 hover:bg-background/70"}`} onClick={() => setTab("rate")} type="button">{copy.shell.rateUsTitle || "Оценить"}</button>
      </div>

      {tab === "about" ? (
        <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{copy.shell.aboutSheet || "О нас"}</p>
          <h3 className="mt-2 text-2.5xl font-black">SmartNotes</h3>
          
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {developers.map((dev) => (
              <div key={dev.name} className="flex items-center gap-3 rounded-2xl border border-border bg-surface/50 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 font-black text-accent text-xs">
                  {dev.name.split(" ").map(n => n[0]).join("")}
                </span>
                <div>
                  <p className="text-sm font-black text-foreground leading-tight">{dev.name}</p>
                  <p className="text-[10px] font-bold text-foreground/48 mt-0.5">{dev.role}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-border my-4" />

          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/42">Обратная связь</h4>
          <a
            className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/50 p-3 hover:bg-surface transition group"
            href="https://t.me/SmartNotesInfo_bot"
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.68-.82 3.82-1.16 5.44-.14.68-.42.91-.66.93-.53.05-1.01-.27-1.42-.54-.64-.42-1-.69-1.62-1.1-.71-.47-.25-.73.15-1.16.1-.11 1.93-1.77 1.97-1.92.01-.02.01-.09-.03-.13-.04-.04-.1-.03-.15-.02-.06.01-1.07.68-3.03 2-.29.2-.55.3-.77.29-.25-.01-.73-.15-1.08-.27-.44-.14-.79-.22-.76-.46.02-.13.2-.26.54-.4 2.11-.92 7.02-3.01 8.02-3.4.95-.37 1.76-.11 1.76.62z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-black text-foreground">Telegram Bot</p>
                <p className="text-xs text-foreground/48">@SmartNotesInfo_bot</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{copy.shell.rateUsTitle || "Оценить"}</p>
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition sm:h-11 sm:w-11 ${rating >= value ? "border-amber-400 bg-amber-400/12 text-amber-400" : "border-border bg-background text-foreground/42 hover:bg-surface"}`} key={value} onClick={() => setRating(value)} type="button">
                <Star className={`h-5 w-5 ${rating >= value ? "fill-current" : ""}`} />
              </button>
            ))}
          </div>
          <textarea className="mt-4 min-h-32 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none" onChange={(event) => setFeedback(event.target.value)} placeholder={copy.shell.feedbackPlaceholder || "Feedback, пояснение"} value={feedback} />
          <Button className="mt-4 w-full rounded-2xl" onClick={handleFeedbackSubmit} type="button">{copy.shell.sendFeedback || "Отправить"}</Button>
        </section>
      )}
    </div>
  );
}

function CreateFolderContent({ copy, onClose }: { copy: ReturnType<typeof getUiCopy>; onClose: () => void }) {
  const { addFolder } = useFolderActions();
  const [name, setName] = useState("");
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");
  const dlgs = copy.shell.dialogs;

  function handleCreate() {
    const normalized = name.trim();

    if (!normalized) {
      return;
    }

    void addFolder({ name: normalized, description: null, isHidden: false }, userId);
    setName("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><input className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" onChange={(event) => setName(event.target.value)} placeholder={dlgs?.folderCreatePrompt || "Введите название папки"} value={name} /><Button className="h-10 w-full rounded-2xl sm:h-11" disabled={!name.trim()} onClick={handleCreate} type="button">{dlgs?.folderCreateButton || "Создать папку"}</Button></div>;
}

function ReminderContent({ copy, onClose }: { copy: ReturnType<typeof getUiCopy>; onClose: () => void }) {
  const { data: notes = [] } = useNotesFlat();
  const { setReminder } = useNoteActions();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;
  const [value, setValue] = useState(note?.reminderAt ? note.reminderAt.slice(0, 16) : "");

  useEffect(() => {
    if (!currentNoteId || !note) {
      return;
    }

    setValue(note.reminderAt ? note.reminderAt.slice(0, 16) : "");
    scheduleReminder(currentNoteId, note.reminderAt);
  }, [currentNoteId, note]);

  if (!currentNoteId || !note) {
    return null;
  }

  return <div className="mt-4 space-y-3"><input className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" onChange={(event) => setValue(event.target.value)} type="datetime-local" value={value} /><div className="grid grid-cols-2 gap-2"><Button className="h-10 rounded-2xl sm:h-11" disabled={!value} onClick={async () => { const reminderAt = new Date(value).toISOString(); await setReminder(currentNoteId, reminderAt); scheduleReminder(currentNoteId, reminderAt); await requestNotificationPermission(); onClose(); }} type="button">{copy.common.save || "Сохранить"}</Button><Button className="h-10 rounded-2xl sm:h-11" onClick={() => { void setReminder(currentNoteId, null); scheduleReminder(currentNoteId, null); onClose(); }} type="button" variant="secondary">{copy.common.reset || "Очистить"}</Button></div></div>;
}

// Removed DiagnosticsContent

function ShareContent({ onClose }: { onClose: () => void }) {
  const { data: notes = [] } = useNotesFlat();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;

  if (!note) return null;

  return (
    <SharePrompt
      noteId={note.id}
      noteTitle={note.title}
      ownerId={note.ownerId}
      onClose={onClose}
    />
  );
}

type HeaderInvite = {
  id: string;
  noteId: string;
  noteTitle: string;
  inviterEmail: string;
  inviterName: string | null;
  role: "owner" | "editor" | "viewer";
  token: string;
  expiresAt: string | null;
  createdAt: string;
};

function InvitesContent({ copy }: { copy: ReturnType<typeof getUiCopy> }) {
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const user = useAuthStore((state) => state.user);
  const [myInvites, setMyInvites] = useState<HeaderInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    collabRepository.fetchMyPendingInvites(user.email).then((list) => {
      setMyInvites(list);
      setLoading(false);
    });
  }, [user?.email]);

  async function handleAcceptInvite(invite: HeaderInvite) {
    if (!user) return;
    try {
      await collabRepository.acceptInviteByToken(invite.token, user.id);
      setMyInvites((prev) => prev.filter((i) => i.id !== invite.id));
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRejectInvite(invite: HeaderInvite) {
    try {
      await collabRepository.rejectInviteByToken(invite.token);
      setMyInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      console.error(err);
    }
  }

  const dlgs = copy.shell.dialogs;

  if (loading) {
    return <div className="mt-4 py-8 text-center text-sm text-foreground/50">{lang === "ru" ? "Загрузка приглашений..." : "Loading invites..."}</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {myInvites.length > 0 ? (
        <div className="space-y-2">
          {myInvites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-border bg-surface-strong/70 p-3.5 text-sm">
              <p className="font-bold text-foreground leading-snug">
                {(dlgs?.collabInviteNote || "Заметка") + ": \"" + invite.noteTitle + "\""}
              </p>
              <p className="text-xs text-foreground/48 mt-1">
                {(dlgs?.collabInviteFrom || "От") + ": " + invite.inviterEmail}
              </p>
              <div className="flex gap-2 mt-3.5">
                <button
                  onClick={() => handleAcceptInvite(invite)}
                  className="flex-1 rounded-xl bg-accent py-2 text-xs font-black text-background hover:opacity-90 transition"
                  type="button"
                >
                  {dlgs?.collabAccept || "Принять"}
                </button>
                <button
                  onClick={() => handleRejectInvite(invite)}
                  className="rounded-xl bg-background border border-border px-3 py-2 text-xs font-bold text-foreground/64 hover:bg-surface-strong transition"
                  type="button"
                >
                  {dlgs?.collabReject || "Отклонить"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.2rem] border border-dashed border-border bg-surface-strong p-6 text-center text-sm text-foreground/56">
          {lang === "ru" ? "У вас нет ожидающих приглашений." : "You have no pending invites."}
        </div>
      )}
    </div>
  );
}

