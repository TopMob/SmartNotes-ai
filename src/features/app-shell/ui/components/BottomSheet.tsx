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

import { exportNoteAsPdf, exportNoteAsTxt, exportNoteForImport, getNotePlainText, shareFolder, shareNote, type SheetState } from "./shared";

type BottomSheetProps = {
  sheet: SheetState;
  activeFolder: FolderEntity | null;
  editorDirty: boolean;
  isDesktop: boolean;
  onClose: () => void;
};

export function BottomSheet({ sheet, activeFolder, isDesktop, onClose }: BottomSheetProps) {
  if (!sheet) {
    return null;
  }

  const { name, anchor } = sheet;
  const title =
    name === "folder"
      ? "Папка"
      : name === "note"
        ? "Действия заметки"
        : name === "pages"
          ? "Страницы"
          : name === "lock"
            ? "Lock Center"
            : name === "create-folder"
              ? "Создать папку"
              : name === "reminder"
                ? "Напоминание"
                : name === "admin-tools"
                  ? "Диагностика"
                  : "О приложении";
  const topSheet = name === "pages";
  const mobileSheet = !isDesktop;
  const folderPopup = name === "folder" && !!anchor && !mobileSheet;

  function renderSheetContent() {
    return (
      <section
        className={`absolute border border-border bg-surface p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl ${mobileSheet ? "inset-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[2rem]" : name === "note" || name === "about" ? "left-1/2 top-1/2 w-[min(92vw,32rem)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem]" : anchor ? "w-[min(92vw,24rem)] max-h-[82vh] overflow-y-auto rounded-[1.8rem]" : topSheet ? "inset-x-0 top-0 max-h-[86vh] overflow-y-auto rounded-b-[2rem] lg:left-1/2 lg:top-4 lg:w-[min(94vw,48rem)] lg:-translate-x-1/2 lg:rounded-[2rem]" : "inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[2rem] lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-[2rem]"}`}
        style={name === "note" || name === "about" || mobileSheet || !anchor ? undefined : { left: `${anchor.x}px`, top: `${anchor.y}px`, transform: `translate(-50%, ${anchor.placement === "above" ? "-100%" : "0"})` }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-xl font-black">{title}</h2>
          <button className="rounded-full p-2 hover:bg-surface-strong" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        {name === "folder" ? <FolderActionList activeFolder={activeFolder} /> : null}
        {name === "note" ? <NoteActionSheet /> : null}
        {name === "pages" ? <PagesContent /> : null}
        {name === "lock" ? <LockContent onClose={onClose} /> : null}
        {name === "about" ? <AboutContent /> : null}
        {name === "admin-tools" ? <DiagnosticsContent /> : null}
        {name === "create-folder" ? <CreateFolderContent onClose={onClose} /> : null}
        {name === "reminder" ? <ReminderContent onClose={onClose} /> : null}
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

function getLockPassword(promptText: string) {
  const value = window.prompt(promptText);

  if (value === null) {
    return null;
  }

  const password = value.trim();

  if (!password) {
    window.alert("Пароль не может быть пустым.");
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

function NoteActionSheet() {
  const { data: notes = [] } = useNotesFlat();
  const { data: folders = [] } = useFoldersQuery();
  const { moveNoteToFolder, patchNote, restoreNote, permanentlyDeleteNote, setArchived, setReminder, trashNote } = useNoteActions();
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const note = notes.find((item) => item.id === currentNoteId) ?? null;
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);

  async function toggleNoteLock() {
    if (!note) {
      return false;
    }

    if (note.lock) {
      const password = getLockPassword("Введите пароль для снятия блокировки");

      if (!password) {
        return false;
      }

      const valid = await verifyNoteLock(note.lock, password);

      if (!valid) {
        window.alert("Неверный пароль.");
        return false;
      }

      await patchNote(note.id, { lock: { ...note.lock, hidden: !note.lock.hidden } }, { scheduleAnalysis: false });
      return true;
    }

    const password = getLockPassword("Задайте пароль для заметки");

    if (!password) {
      return false;
    }

    const confirmPassword = getLockPassword("Повторите пароль для подтверждения");

    if (!confirmPassword) {
      return false;
    }

    if (password !== confirmPassword) {
      window.alert("Пароли не совпадают.");
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
      <div className="grid gap-2 sm:grid-cols-2">
        {note.trashedAt ? (
          <>
            <ActionCard label="Восстановить" onClick={() => void restoreNote(note.id)} />
            <ActionCard destructive label="Удалить навсегда" onClick={() => void permanentlyDeleteNote(note.id)} />
          </>
        ) : (
          <>
            <ActionCard label="Отметить для повторного анализа" onClick={() => void patchNote(note.id, { aiStatus: "pending", aiProcessed: false, analyzed: false, aiError: null }, { scheduleAnalysis: false })} />
            <ActionCard label={note.lock?.hidden ? "Показать по паролю" : note.lock ? "Скрыть снова" : "Заблокировать заметку"} onClick={() => void toggleNoteLock()} />
            <ActionCard label={note.isArchived ? "Вернуть из архива" : "Архивировать"} onClick={() => void setArchived(note.id, !note.isArchived)} />
            <ActionCard destructive label="Удалить" onClick={() => void trashNote(note.id)} />
            <ActionCard label="Копировать текст" onClick={() => void copyNoteText(note)} />
            <ActionCard label="Поделиться заметкой" onClick={() => void shareNote(note)} />
            <ActionCard label="Переместить в папку" onClick={() => setFolderPickerOpen((value) => !value)} />
            <ActionCard label={note.reminderAt ? "Очистить напоминание" : "Напоминание"} onClick={() => { const reminderAt = note.reminderAt ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); void setReminder(note.id, reminderAt); scheduleReminder(note.id, reminderAt); }} />
            <ActionCard label="Скачать файл для импорта" onClick={() => exportNoteForImport(note)} />
            <ActionCard label="Скачать TXT" onClick={() => exportNoteAsTxt(note)} />
            <ActionCard label="Экспорт PDF" onClick={() => exportNoteAsPdf(note)} />
          </>
        )}
      </div>

      {folderPickerOpen ? (
        <div className="rounded-[1.5rem] border border-border bg-surface-strong p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-foreground/42">Папки</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionCard label="Без папки" onClick={() => { void moveNoteToFolder(note.id, null); setFolderPickerOpen(false); }} />
            {visibleFolders.map((folder) => (
              <ActionCard key={folder.id} label={folder.name} onClick={() => { void moveNoteToFolder(note.id, folder.id); setFolderPickerOpen(false); }} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 rounded-[1.5rem] border border-border bg-surface-strong p-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Ваш доступ: {note.access.length ? note.access[0].role : "локальный"}</div>
        <div className="rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-foreground/72">Статус анализа: {note.aiStatus === "done" ? "готово" : note.aiStatus === "pending" ? "в очереди" : note.aiStatus === "analyzing" ? "анализируется" : "ошибка"}</div>
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

function FolderActionList({ activeFolder }: { activeFolder: FolderEntity | null }) {
  const { hideFolder, moveFolder, renameFolder, trashFolder, unhideFolder, updateFolderDescription } = useFolderActions();

  if (!activeFolder) {
    return null;
  }

  const folder = activeFolder;

  function handleRename() {
    const nextName = window.prompt("Новое имя папки", folder.name)?.trim();

    if (!nextName) {
      return;
    }

    void renameFolder(folder.id, nextName);
  }

  function handleDelete() {
    if (!window.confirm(`Удалить папку «${folder.name}»?`)) {
      return;
    }

    void trashFolder(folder.id);
  }

  function handleDescription() {
    const nextValue = window.prompt("Описание папки", folder.description ?? "");

    if (nextValue === null) {
      return;
    }

    const nextDescription = nextValue.trim() || null;

    void updateFolderDescription(folder.id, nextDescription);
  }

  return (
    <div className="mt-4 space-y-2">
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void shareFolder(folder)} type="button">Поделиться</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={handleRename} type="button">Переименовать</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={handleDescription} type="button">Изменить описание</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void moveFolder(folder.id, -1)} type="button">Поднять выше</button>
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void moveFolder(folder.id, 1)} type="button">Опустить ниже</button>
      {folder.isHidden ? <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void unhideFolder(folder.id)} type="button">Показать</button> : <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" onClick={() => void hideFolder(folder.id)} type="button">Скрыть</button>}
      <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-rose-500 hover:bg-surface-strong" onClick={handleDelete} type="button">Удалить</button>
    </div>
  );
}

function PagesContent() {
  const currentNoteId = useNoteUiStore((state) => state.currentNoteId);
  const currentNotePageIndex = useNoteUiStore((state) => state.currentNotePageIndex);
  const setCurrentNotePageIndex = useNoteUiStore((state) => state.setCurrentNotePageIndex);
  const { noteId } = useNoteCollabSession();
  const { pages, addPage, removePage: removeCollabPage, setPageTitle } = useNoteCollabPage(currentNotePageIndex);

  if (!currentNoteId || currentNoteId !== noteId) {
    return null;
  }

  function renamePage(pageId: string, currentTitle: string) {
    const nextTitle = window.prompt("Название страницы", currentTitle)?.trim();

    if (!nextTitle) {
      return;
    }

    if (!currentNoteId) {
      return;
    }

    setPageTitle(pageId, nextTitle);
  }

  function removePage(pageId: string) {
    if (!window.confirm("Удалить страницу?")) {
      return;
    }

    if (!currentNoteId) {
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
            {pages.length > 1 ? <button className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-background" onClick={() => removePage(page.id)} type="button">Удалить</button> : null}
          </div>
        ))}
      </div>
      <Button className="w-full rounded-2xl" onClick={() => currentNoteId ? addPage() : null} type="button" variant="secondary">Добавить страницу</Button>
    </div>
  );
}

function LockContent({ onClose }: { onClose: () => void }) {
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

  async function handleUnlock() {
    const valid = await verifyNoteLock(currentLock, password);

    if (!valid) {
      setError("Неверный пароль");
      return;
    }

    if (!currentNoteId) {
      return;
    }

    await patchNote(currentNoteId, { lock: { ...currentLock, hidden: false } }, { scheduleAnalysis: false });
    setError(null);
    setPassword("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-foreground/58">Контент заметки скрыт до локальной verify-проверки. Preview уже замаскирован в карточке.</p><input autoComplete="off" className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" name={`lock_${currentNoteId.slice(0, 6)}`} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль заметки" type="password" value={password} />{error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}<Button className="h-10 w-full rounded-2xl sm:h-11" onClick={() => void handleUnlock()} type="button">Unlock</Button></div>;
}

function AboutContent() {
  const { data: settings } = useSettingsQuery();
  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);
  const [tab, setTab] = useState<"about" | "rate">("about");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  function handleFeedbackSubmit() {
    publish("feedbackSubmitted", {
      rating,
      feedback,
      diagnostics: getConsoleLogs(),
      systemLanguage: navigator.language,
      userAgent: navigator.userAgent,
    });
    window.alert("Спасибо за обратную связь!");
    setFeedback("");
  }

  return (
    <div className="mt-5 grid gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-border bg-surface-strong p-2">
        <button className={`rounded-xl px-4 py-3 text-sm font-black transition ${tab === "about" ? "bg-background text-accent" : "text-foreground/72 hover:bg-background/70"}`} onClick={() => setTab("about")} type="button">О нас</button>
        <button className={`rounded-xl px-4 py-3 text-sm font-black transition ${tab === "rate" ? "bg-background text-accent" : "text-foreground/72 hover:bg-background/70"}`} onClick={() => setTab("rate")} type="button">Оценить</button>
      </div>

      {tab === "about" ? (
        <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">О нас</p>
          <h3 className="mt-3 text-2xl font-black">SmartNotes</h3>
          <ul className="mt-4 space-y-2 text-sm text-foreground/70">
            <li>Александров Арсений</li>
            <li>Малышев Егор</li>
            <li>Миняев Иван</li>
            <li>Копаев Иван</li>
          </ul>
          <h3 className="mt-3 text-2xl font-black">Обратная связь</h3>
          <a className="mt-4 inline-flex font-black text-accent hover:underline" href="https://t.me/SmartNotesInfo_bot" rel="noreferrer" target="_blank">@SmartNotesInfo_bot</a>
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-border bg-surface-strong p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Оценить</p>
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition sm:h-11 sm:w-11 ${rating >= value ? "border-amber-400 bg-amber-400/12 text-amber-400" : "border-border bg-background text-foreground/42 hover:bg-surface"}`} key={value} onClick={() => setRating(value)} type="button">
                <Star className={`h-5 w-5 ${rating >= value ? "fill-current" : ""}`} />
              </button>
            ))}
          </div>
          <textarea className="mt-4 min-h-32 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none" onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback, пояснение" value={feedback} />
          <Button className="mt-4 w-full rounded-2xl" onClick={handleFeedbackSubmit} type="button">Отправить</Button>
        </section>
      )}
    </div>
  );
}

function CreateFolderContent({ onClose }: { onClose: () => void }) {
  const { addFolder } = useFolderActions();
  const [name, setName] = useState("");
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");

  function handleCreate() {
    const normalized = name.trim();

    if (!normalized) {
      return;
    }

    void addFolder({ name: normalized, description: null, isHidden: false }, userId);
    setName("");
    onClose();
  }

  return <div className="mt-4 space-y-3"><input className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" onChange={(event) => setName(event.target.value)} placeholder="Введите название папки" value={name} /><Button className="h-10 w-full rounded-2xl sm:h-11" disabled={!name.trim()} onClick={handleCreate} type="button">Создать папку</Button></div>;
}

function ReminderContent({ onClose }: { onClose: () => void }) {
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

  return <div className="mt-4 space-y-3"><input className="h-10 w-full rounded-2xl border border-border bg-surface-strong px-4 outline-none sm:h-12" onChange={(event) => setValue(event.target.value)} type="datetime-local" value={value} /><div className="grid grid-cols-2 gap-2"><Button className="h-10 rounded-2xl sm:h-11" disabled={!value} onClick={async () => { const reminderAt = new Date(value).toISOString(); await setReminder(currentNoteId, reminderAt); scheduleReminder(currentNoteId, reminderAt); await requestNotificationPermission(); onClose(); }} type="button">Сохранить</Button><Button className="h-10 rounded-2xl sm:h-11" onClick={() => { void setReminder(currentNoteId, null); scheduleReminder(currentNoteId, null); onClose(); }} type="button" variant="secondary">Очистить</Button></div></div>;
}

export function DiagnosticsContent() {
  const collabDiagnostics = listCollabDiagnostics();
  const mediaDiagnostic = getMediaDiagnostic();
  const syncQueue = listSyncQueue();
  const aiQueue = listPendingAiAnalysis();

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
