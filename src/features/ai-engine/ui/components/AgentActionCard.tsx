import {
  FolderPlus,
  FolderInput,
  Tag,
  CheckCircle2,
  Loader2,
  Play,
  AlertTriangle,
  FilePlus2,
  Pencil,
  Trash2,
  Archive,
  Combine,
  Sparkles,
} from "lucide-react";
import type { AiAction } from "@/features/ai-engine/model/agent-actions";
import type { Folder as FolderEntity } from "@/entities/folder";
import type { Note } from "@/entities/note";

interface AgentActionCardProps {
  msgId: string;
  actions: AiAction[];
  actionsStatus?: "pending" | "running" | "completed" | "error";
  actionError?: string;
  confirmDanger?: boolean;
  rawFolders: FolderEntity[];
  notes: Note[];
  onConfirmDanger: (msgId: string) => void;
  onDismissActions: (msgId: string) => void;
  onExecuteActions: (msgId: string, actionsList: AiAction[]) => void;
}

function isDangerousAction(action: AiAction) {
  return (
    action.type === "deleteFolder" ||
    action.type === "deleteNotes" ||
    action.type === "mergeFolders" ||
    action.type === "mergeNotes"
  );
}

export function AgentActionCard({
  msgId,
  actions,
  actionsStatus,
  actionError,
  confirmDanger,
  rawFolders,
  notes,
  onConfirmDanger,
  onDismissActions,
  onExecuteActions,
}: AgentActionCardProps) {
  if (!actions || actions.length === 0 || !actionsStatus) return null;

  return (
    <div className="mt-3 w-[92%] overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/90 to-indigo-50/40 p-3.5 shadow-sm dark:border-violet-950/30 dark:from-violet-950/10 dark:to-indigo-950/5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
        <Sparkles className="h-4 w-4 fill-violet-200 dark:fill-violet-950 animate-pulse" />
        <span className="text-xs font-black uppercase tracking-wider">⚡ AI Предложение</span>
      </div>

      <div className="mt-2.5 space-y-2">
        {actions.map((act, idx) => {
          if (act.type === "createFolder") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Создать папку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.folderName}»</strong>
                </span>
              </div>
            );
          }
          if (act.type === "renameFolder") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Переименовать папку в <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.name}»</strong>
                </span>
              </div>
            );
          }
          if (act.type === "trashFolder" || act.type === "restoreFolder" || act.type === "deleteFolder") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {act.type === "trashFolder"
                    ? "Переместить папку в корзину"
                    : act.type === "restoreFolder"
                    ? "Восстановить папку"
                    : "Удалить папку навсегда"}
                </span>
              </div>
            );
          }
          if (act.type === "mergeFolders") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Combine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>Объединить {act.sourceFolderIds.length} папки</span>
              </div>
            );
          }
          if (act.type === "createNote") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FilePlus2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Создать заметку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong>
                </span>
              </div>
            );
          }
          if (act.type === "updateNote" || act.type === "renameNote") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {act.type === "renameNote"
                    ? `Переименовать заметку в «${act.title}»`
                    : "Обновить содержимое заметки"}
                </span>
              </div>
            );
          }
          if (act.type === "moveNotesToFolder") {
            const notesCount = act.noteIds?.length ?? 0;
            const targetFolderName =
              act.folderName ?? rawFolders.find((folder) => folder.id === act.folderId)?.name ?? null;
            const noteNames = act.noteIds
              ? act.noteIds
                  .map((nid) => notes.find((n) => n.id === nid)?.title || "Без названия")
                  .join(", ")
              : "";
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FolderInput className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {targetFolderName ? (
                    <>
                      Перенести {notesCount} заметку(-и) в папку{" "}
                      <strong className="font-semibold text-violet-700 dark:text-violet-400">
                        «{targetFolderName}»
                      </strong>
                    </>
                  ) : (
                    <>Убрать папку у {notesCount} заметки(-ок)</>
                  )}
                  <span className="block mt-0.5 text-[10px] text-foreground/45">({noteNames})</span>
                </span>
              </div>
            );
          }
          if (act.type === "mergeNotes") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Combine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Объединить {act.noteIds.length} заметки в{" "}
                  <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong>
                </span>
              </div>
            );
          }
          if (act.type === "trashNotes" || act.type === "restoreNotes" || act.type === "deleteNotes") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {act.type === "trashNotes"
                    ? "Переместить заметки в корзину"
                    : act.type === "restoreNotes"
                    ? "Восстановить заметки"
                    : "Удалить заметки навсегда"}
                </span>
              </div>
            );
          }
          if (act.type === "archiveNotes" || act.type === "unarchiveNotes") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {act.type === "archiveNotes" ? "Архивировать заметки" : "Убрать заметки из архива"}
                </span>
              </div>
            );
          }
          if (act.type === "addTagsToNotes") {
            const notesCount = act.noteIds?.length ?? 0;
            const tagsList = act.tags?.join(", ") ?? "";
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Добавить теги <strong className="font-semibold text-violet-700 dark:text-violet-400">[{tagsList}]</strong> к{" "}
                  {notesCount} заметке(-ам)
                </span>
              </div>
            );
          }
          if (act.type === "removeTagsFromNotes") {
            const notesCount = act.noteIds?.length ?? 0;
            const tagsList = act.tags?.join(", ") ?? "";
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Убрать теги <strong className="font-semibold text-violet-700 dark:text-violet-400">[{tagsList}]</strong> у{" "}
                  {notesCount} заметке(-ок)
                </span>
              </div>
            );
          }
          if (act.type === "createStructuredIdeaNote") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  Создать структурированную заметку <strong className="font-semibold text-violet-700 dark:text-violet-400">«{act.title}»</strong>
                  <span className="mt-0.5 block text-[10px] text-foreground/45">
                    Режим: {act.saveMode === "human_plus_ai" ? "Human + AI" : "AI only"}
                  </span>
                </span>
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="mt-3.5 border-t border-violet-100/50 pt-3 dark:border-violet-950/20">
        {actions.some(isDangerousAction) && actionsStatus === "pending" && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            Это опасное действие: удаление или объединение. Нужна отдельная явная проверка.
          </div>
        )}

        <div className="flex items-center justify-end">
          {actionsStatus === "pending" && (
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground/70 transition hover:bg-surface-strong/60"
                type="button"
                onClick={() => onDismissActions(msgId)}
              >
                Пропустить
              </button>
              {actions.some(isDangerousAction) && !confirmDanger ? (
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-1.5 text-xs font-black text-amber-900 transition hover:bg-amber-200 active:scale-95 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                  type="button"
                  onClick={() => onConfirmDanger(msgId)}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Подтвердить риск
                </button>
              ) : (
                <button
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-violet-600/20 transition hover:bg-violet-500 active:scale-95"
                  type="button"
                  onClick={() => onExecuteActions(msgId, actions)}
                >
                  <Play className="h-3 w-3 fill-current" />
                  {actions.some(isDangerousAction) ? "Выполнить опасное действие" : "Выполнить"}
                </button>
              )}
            </div>
          )}

          {actionsStatus === "running" && (
            <div className="flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Применяю изменения...</span>
            </div>
          )}

          {actionsStatus === "completed" && (
            <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-200" />
              <span>Готово! Изменения применены.</span>
            </div>
          )}

          {actionsStatus === "error" && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{actionError || "Ошибка применения."}</span>
              <button
                className="ml-2 underline font-black hover:text-rose-800 dark:hover:text-rose-300"
                type="button"
                onClick={() => onExecuteActions(msgId, actions)}
              >
                Повторить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
