import { Pencil, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useNoteCollabPage } from "@/features/editor-collab/hooks/use-note-collab-page";
import { useNoteCollabSession } from "@/features/editor-collab/hooks/use-note-collab-session";
import { useFolderActions } from "@/features/folders/hooks/use-folder-mutations";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { createNoteLock, verifyNoteLock } from "@/features/lock-center/lib/lock-service";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { useNoteUiStore } from "@/features/notes/model/note-ui-store";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { getMediaDiagnostic, listCollabDiagnostics } from "@/services/diagnostics/runtime-diagnostics";
import { publish } from "@/services/event-bus";
import { requestNotificationPermission } from "@/services/notifications/notification-service";
import { scheduleReminder } from "@/services/reminders/reminder-service";
import { clearAiAnalysisQueue, listPendingAiAnalysis } from "@/services/ai/ai-queue";
import { listSyncQueue } from "@/services/sync/sync-queue";
import { getConsoleLogs } from "@/services/console-log-store";
import { getUiCopy } from "@/shared/lib/i18n";
import { Button } from "@/shared/ui/button";
import { SharePrompt } from "@/features/editor-collab/ui/share-prompt";
import { AiSummaryCard } from "@/features/editor/ui/AiSummaryCard";
import { useAiEngineStore } from "@/features/ai-engine/model/ai-store";
import { getAdminEmails, saveAdminEmails } from "@/features/auth/lib/admin-acl";

import { exportNoteAsPdf, exportNoteAsTxt, exportNoteForImport, getNotePlainText, shareFolder, type SheetState, type SheetAnchor, type SheetName } from "./shared";

type BottomSheetProps = {
  sheet: SheetState;
  activeFolder: FolderEntity | null;
  editorDirty: boolean;
  isDesktop: boolean;
  onClose: () => void;
  onOpenSheet?: (name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void;
};

export function BottomSheet({ sheet, activeFolder, isDesktop, onClose, onOpenSheet }: BottomSheetProps) {
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
                : name === "admin-tools"
                  ? copy.shell.adminTools
                  : name === "share"
                    ? copy.shell.actions.share
                    : copy.shell.aboutSheet;
  const topSheet = name === "pages";
  const mobileSheet = !isDesktop;
  const folderPopup = name === "folder" && !!anchor && !mobileSheet;

  function renderSheetContent() {
    return (
      <section
        className={`absolute border border-border bg-surface p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl ${mobileSheet ? "inset-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[2rem]" : name === "note" || name === "about" || name === "share" ? "left-1/2 top-1/2 w-[min(92vw,32rem)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem]" : anchor ? "w-[min(92vw,24rem)] max-h-[82vh] overflow-y-auto rounded-[1.8rem]" : topSheet ? "inset-x-0 top-0 max-h-[86vh] overflow-y-auto rounded-b-[2rem] lg:left-1/2 lg:top-4 lg:w-[min(94vw,48rem)] lg:-translate-x-1/2 lg:rounded-[2rem]" : "inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[2rem] lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-[2rem]"}`}
        style={name === "note" || name === "about" || name === "share" || mobileSheet || !anchor ? undefined : { left: `${anchor.x}px`, top: `${anchor.y}px`, transform: `translate(-50%, ${anchor.placement === "above" ? "-100%" : "0"})` }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-xl font-black">{title}</h2>
          <button className="rounded-full p-2 hover:bg-surface-strong" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        {name === "folder" ? <FolderActionList copy={copy} activeFolder={activeFolder} /> : null}
        {name === "note" ? <NoteActionSheet copy={copy} onOpenSheet={onOpenSheet} /> : null}
        {name === "pages" ? <PagesContent copy={copy} /> : null}
        {name === "lock" ? <LockContent copy={copy} onClose={onClose} /> : null}
        {name === "about" ? <AboutContent copy={copy} /> : null}
        {name === "admin-tools" ? <DiagnosticsContent /> : null}
        {name === "create-folder" ? <CreateFolderContent copy={copy} onClose={onClose} /> : null}
        {name === "reminder" ? <ReminderContent copy={copy} onClose={onClose} /> : null}
        {name === "share" ? <ShareContent onClose={onClose} /> : null}
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
      <button className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} type="button" />
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

function NoteActionSheet({ copy, onOpenSheet }: { copy: ReturnType<typeof getUiCopy>; onOpenSheet?: (name: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void }) {
  const { data: notes = [] } = useNotesFlat();
  const { data: folders = [] } = useFoldersQuery();
  const { moveNoteToFolder, patchNote, restoreNote, permanentlyDeleteNote, setArchived, setReminder, trashNote } = useNoteActions();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  const aiStatus = useAiEngineStore((state) => state.status);
  const dlgs = copy.shell.dialogs;

  async function toggleNoteLock() {
    if (!note) {
      return false;
    }

    if (note.lock) {
      const password = getLockPassword(
        dlgs?.lockPromptUnlock || "Введите пароль для снятия блокировки",
        dlgs?.lockAlertEmpty || "Пароль не может быть пустым."
      );

      if (!password) {
        return false;
      }

      const valid = await verifyNoteLock(note.lock, password);

      if (!valid) {
        window.alert(dlgs?.lockAlertIncorrect || "Неверный пароль.");
        return false;
      }

      await patchNote(note.id, { lock: { ...note.lock, hidden: !note.lock.hidden } }, { scheduleAnalysis: false });
      return true;
    }

    const password = getLockPassword(
      dlgs?.lockPromptSet || "Задайте пароль для заметки",
      dlgs?.lockAlertEmpty || "Пароль не может быть пустым."
    );

    if (!password) {
      return false;
    }

    const confirmPassword = getLockPassword(
      dlgs?.lockConfirmPassword || "Повторите пароль для подтверждения",
      dlgs?.lockAlertEmpty || "Пароль не может быть пустым."
    );

    if (!confirmPassword) {
      return false;
    }

    if (password !== confirmPassword) {
      window.alert(dlgs?.lockAlertMismatch || "Пароли не совпадают.");
      return false;
    }

    const lock = await createNoteLock(password);
    await patchNote(note.id, { lock }, { scheduleAnalysis: false });
    return true;
  }

  if (!currentNoteId || !note) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 pb-6">
      <AiSummaryCard summary={note.metadata?.summary as string | undefined} aiStatus={aiStatus} />
      <div className="grid gap-2 sm:grid-cols-2">
        {note.trashedAt ? (
          <>
            <ActionCard label={copy.shell.actions.restore} onClick={() => void restoreNote(note.id)} />
            <ActionCard destructive label={copy.shell.actions.permanentDelete} onClick={() => void permanentlyDeleteNote(note.id)} />
          </>
        ) : (
          <>
            <ActionCard label={dlgs?.reanalyze || "Отметить для повторного анализа"} onClick={() => void patchNote(note.id, { aiStatus: "pending", aiProcessed: false, analyzed: false, aiError: null }, { scheduleAnalysis: false })} />
            <ActionCard label={note.lock?.hidden ? (dlgs?.lockShow || "Показать по паролю") : note.lock ? (dlgs?.lockHide || "Скрыть снова") : (dlgs?.lockNote || "Заблокировать заметку")} onClick={() => void toggleNoteLock()} />
            <ActionCard label={note.isArchived ? (dlgs?.unarchive || "Вернуть из архива") : copy.shell.actions.archive} onClick={() => void setArchived(note.id, !note.isArchived)} />
            <ActionCard destructive label={copy.shell.actions.delete} onClick={() => void trashNote(note.id)} />
            <ActionCard label={dlgs?.copyText || "Копировать текст"} onClick={() => void copyNoteText(note)} />
            <ActionCard label={dlgs?.collabAccess || "Совместный доступ (коллаборация)"} onClick={() => onOpenSheet?.("share", null)} />
            <ActionCard label={dlgs?.moveToFolder || "Переместить в папку"} onClick={() => setFolderPickerOpen((value) => !value)} />
            <ActionCard label={note.reminderAt ? (dlgs?.clearReminder || "Очистить напоминание") : copy.shell.reminder} onClick={() => { const reminderAt = note.reminderAt ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); void setReminder(note.id, reminderAt); scheduleReminder(note.id, reminderAt); }} />
            <ActionCard label={dlgs?.downloadForImport || "Скачать файл для импорта"} onClick={() => exportNoteForImport(note)} />
            <ActionCard label={dlgs?.downloadTxt || "Скачать TXT"} onClick={() => exportNoteAsTxt(note)} />
            <ActionCard label={dlgs?.exportPdf || "Экспорт PDF"} onClick={() => exportNoteAsPdf(note)} />
          </>
        )}
      </div>

      {folderPickerOpen ? (
        <div className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-foreground/42">{copy.shell.folders}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionCard label={copy.shell.prompts.emptyFolder || "Без папки"} onClick={() => { void moveNoteToFolder(note.id, null); setFolderPickerOpen(false); }} />
            {visibleFolders.map((folder) => (
              <ActionCard key={folder.id} label={folder.name} onClick={() => { void moveNoteToFolder(note.id, folder.id); setFolderPickerOpen(false); }} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 rounded-[1.5rem] border border-border bg-surface-strong p-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">
          {(dlgs?.yourAccess || "Ваш доступ: ") + (note.access.length ? note.access[0].role : (dlgs?.accessLocal || "локальный"))}
        </div>
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">
          {(dlgs?.aiStatusLabel || "Статус анализа: ") + (note.aiStatus === "done" ? copy.shell.status.aiDone : note.aiStatus === "pending" ? copy.shell.status.aiPending : note.aiStatus === "analyzing" ? copy.shell.status.aiAnalyzing : copy.shell.status.aiError)}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ label, onClick, destructive = false }: { label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition sm:min-h-11 ${destructive ? "border-rose-200 bg-rose-500/6 text-rose-600 hover:bg-rose-500/10" : "border-border bg-surface-strong hover:bg-background"}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function FolderActionList({ copy, activeFolder }: { copy: ReturnType<typeof getUiCopy>; activeFolder: FolderEntity | null }) {
  const { hideFolder, moveFolder, renameFolder, trashFolder, unhideFolder, updateFolderDescription } = useFolderActions();

  if (!activeFolder) {
    return null;
  }

  const folder = activeFolder;
  const dlgs = copy.shell.dialogs;

  function handleRename() {
    const nextName = window.prompt(dlgs?.folderRenamePrompt || "Новое имя папки", folder.name)?.trim();

    if (!nextName) {
      return;
    }

    void renameFolder(folder.id, nextName);
  }

  function handleDelete() {
    const confirmMsg = (dlgs?.folderDeleteConfirm || "Удалить папку «{name}»?").replace("{name}", folder.name);
    if (!window.confirm(confirmMsg)) {
      return;
    }

    void trashFolder(folder.id);
  }

  function handleDescription() {
    const nextValue = window.prompt(dlgs?.folderDescriptionPrompt || "Описание папки", folder.description ?? "");

    if (nextValue === null) {
      return;
    }

    const nextDescription = nextValue.trim() || null;

    void updateFolderDescription(folder.id, nextDescription);
  }

  return (
    <div className="mt-4 space-y-2">
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void shareFolder(folder)} type="button">{copy.shell.actions.share}</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={handleRename} type="button">{copy.shell.actions.rename}</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={handleDescription} type="button">{dlgs?.folderDescriptionPrompt || "Изменить описание"}</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void moveFolder(folder.id, -1)} type="button">{copy.shell.actions.move} ↑</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void moveFolder(folder.id, 1)} type="button">{copy.shell.actions.move} ↓</button>
      {folder.isHidden ? <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void unhideFolder(folder.id)} type="button">{copy.shell.actions.unhide}</button> : <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void hideFolder(folder.id)} type="button">{copy.shell.actions.hide}</button>}
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-rose-500 hover:bg-surface-strong" onClick={handleDelete} type="button">{copy.shell.actions.delete}</button>
    </div>
  );
}

function PagesContent({ copy }: { copy: ReturnType<typeof getUiCopy> }) {
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const currentNotePageIndex = useNoteUiStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNoteUiStore((state) => state.setCurrentNotePageIndex);
  const { noteId } = useNoteCollabSession();
  const { pages, addPage, removePage: removeCollabPage, setPageTitle } = useNoteCollabPage(currentNotePageIndex);

  if (!currentNoteId || currentNoteId !== noteId) {
    return null;
  }

  const dlgs = copy.shell.dialogs;

  function renamePage(pageId: string, currentTitle: string) {
    const nextTitle = window.prompt(dlgs?.pageRenamePrompt || "Название страницы", currentTitle)?.trim();

    if (!nextTitle) {
      return;
    }

    setPageTitle(pageId, nextTitle);
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
        {pages.map((page, index) => (
          <div className={`flex items-center gap-3 rounded-2xl p-3 transition ${currentNotePageIndex === index ? "bg-accent/10 text-accent" : "bg-surface-strong hover:bg-background"}`} key={page.id}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setCurrentNotePageIndex(index)} type="button">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-sm font-black text-accent">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{page.title}</span>
            </button>
            <button className="rounded-xl p-2 text-foreground/60 hover:bg-background" onClick={() => renamePage(page.id, page.title)} type="button"><Pencil className="h-4 w-4" /></button>
            {pages.length > 1 ? <button className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-background" onClick={() => removePage(page.id)} type="button">{copy.shell.actions.removePage || "Удалить"}</button> : null}
          </div>
        ))}
      </div>
      <Button className="w-full rounded-2xl" onClick={() => currentNoteId ? addPage() : null} type="button" variant="secondary">{copy.shell.actions.addPage || "Добавить страницу"}</Button>
    </div>
  );
}

function LockContent({ copy, onClose }: { copy: ReturnType<typeof getUiCopy>; onClose: () => void }) {
  const { data: notes = [] } = useNotesFlat();
  const { patchNote } = useNoteActions();
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

    await patchNote(currentNoteId!, { lock: { ...currentLock, hidden: false } }, { scheduleAnalysis: false });
    setError(null);
    setPassword("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-foreground/58">{dlgs?.lockDescription || "Контент заметки скрыт до локальной verify-проверки. Preview уже замаскирован в карточке."}</p><input autoComplete="off" className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" name={`lock_${currentNoteId.slice(0, 6)}`} onChange={(event) => setPassword(event.target.value)} placeholder={dlgs?.lockEnterPassword || "Пароль заметки"} type="password" value={password} />{error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}<Button className="h-10 w-full rounded-2xl sm:h-11" onClick={() => void handleUnlock()} type="button">{dlgs?.lockButton || "Unlock"}</Button></div>;
}

function AboutContent({ copy }: { copy: ReturnType<typeof getUiCopy> }) {
  const [tab, setTab] = useState<"about" | "rate">("about");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const dlgs = copy.shell.dialogs;

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
          <h3 className="mt-3 text-2xl font-black">SmartNotes</h3>
          <ul className="mt-4 space-y-2 text-sm text-foreground/70">
            <li>Александров Арсений</li>
            <li>Малышев Егор</li>
            <li>Миняев Иван</li>
            <li>Копаев Иван</li>
          </ul>
          <h3 className="mt-3 text-2xl font-black">{copy.shell.about || "Обратная связь"}</h3>
          <a className="mt-4 inline-flex font-black text-accent hover:underline" href="https://t.me/SmartNotesInfo_bot" rel="noreferrer" target="_blank">@SmartNotesInfo_bot</a>
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

export function DiagnosticsContent() {
  const collabDiagnostics = listCollabDiagnostics();
  const mediaDiagnostic = getMediaDiagnostic();
  const syncQueue = listSyncQueue();
  const aiQueue = listPendingAiAnalysis();
  const user = useAuthStore((state) => state.user);

  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdminEmails(getAdminEmails());
  }, []);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Некорректный формат почты");
      return;
    }

    if (adminEmails.includes(email)) {
      setError("Почта уже добавлена");
      return;
    }

    const updated = [...adminEmails, email];
    setAdminEmails(updated);
    saveAdminEmails(updated);
    setNewEmail("");
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    if (emailToRemove === "shazak6430@gmail.com") return;
    if (emailToRemove === user?.email?.toLowerCase()) return;

    const updated = adminEmails.filter((email) => email !== emailToRemove);
    setAdminEmails(updated);
    saveAdminEmails(updated);
  };

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-foreground/42">Runtime Diagnostics</div>
        <Button className="mt-3 rounded-2xl" onClick={clearAiAnalysisQueue} type="button" variant="secondary">Очистить AI queue</Button>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Active collab sessions: {collabDiagnostics.length}</div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Sync backlog: {syncQueue.length}</div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">AI queue: {aiQueue.length}</div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Media mode: {mediaDiagnostic.provider}{mediaDiagnostic.degraded ? " (degraded)" : ""}</div>
        </div>
      </section>

      {/* Admin Management Section */}
      <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-foreground/42">Управление администраторами</div>
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setError(null); }}
            placeholder="admin@example.com"
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none"
          />
          <Button className="rounded-2xl shrink-0" onClick={handleAddEmail} type="button">Добавить</Button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-500 font-bold px-1">{error}</p>}
        
        <div className="mt-4 space-y-2">
          {adminEmails.map((email) => {
            const isMain = email === "shazak6430@gmail.com";
            const isSelf = email === user?.email?.toLowerCase();
            const canRemove = !isMain && !isSelf;

            return (
              <div key={email} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">
                <span className="truncate">{email}</span>
                <div className="flex items-center gap-2">
                  {isMain && <span className="text-[10px] bg-accent/10 text-accent px-2 py-1 rounded-lg">Владелец</span>}
                  {isSelf && <span className="text-[10px] bg-foreground/10 text-foreground/70 px-2 py-1 rounded-lg">Вы</span>}
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="text-xs text-rose-500 hover:underline font-bold"
                      type="button"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {collabDiagnostics.map((diagnostic) => (
        <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4" key={diagnostic.noteId}>
          <div className="text-sm font-black">{diagnostic.noteId}</div>
          <div className="mt-2 grid gap-2 text-sm text-foreground/64 sm:grid-cols-2">
            <div>Status: {diagnostic.status}</div>
            <div>Transport: {diagnostic.transport}</div>
            <div>Persistence: {diagnostic.persistence}</div>
            <div>Durable: {diagnostic.durable}</div>
            <div>Hydrated: {diagnostic.hydratedFromQuery ? "yes" : "no"}</div>
            <div>Updated: {new Date(diagnostic.updatedAt).toLocaleString("ru-RU")}</div>
          </div>
          {diagnostic.message ? <p className="mt-2 text-sm text-foreground/56">{diagnostic.message}</p> : null}
        </section>
      ))}

      <section className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
        <div className="text-sm font-black">Media</div>
        <p className="mt-2 text-sm text-foreground/56">{mediaDiagnostic.message}</p>
      </section>
    </div>
  );
}

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
