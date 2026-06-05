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
import { getUiCopy } from "@/shared/lib/i18n";

interface AgentActionCardProps {
  copy: ReturnType<typeof getUiCopy>;
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
  copy,
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
        <span className="text-xs font-black uppercase tracking-wider">{copy.ai.agent.suggestion}</span>
      </div>

      <div className="mt-2.5 space-y-2">
        {actions.map((act, idx) => {
          if (act.type === "createFolder") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {copy.ai.agent.createFolder.split("{name}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{act.folderName}</strong>}
                      {part}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          if (act.type === "renameFolder") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {copy.ai.agent.renameFolder.split("{name}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{act.name}</strong>}
                      {part}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          if (act.type === "updateFolderDescription") {
            const folderName = rawFolders.find((f) => f.id === act.folderId)?.name ?? copy.ai.agent.untitled;
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {copy.ai.agent.updateFolderDescription.split("{name}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{folderName}</strong>}
                      {part.split("{description}").map((subPart, j) => (
                        <span key={j}>
                          {j > 0 && act.description}
                          {subPart}
                        </span>
                      ))}
                    </span>
                  ))}
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
                    ? copy.ai.agent.trashFolder
                    : act.type === "restoreFolder"
                    ? copy.ai.agent.restoreFolder
                    : copy.ai.agent.deleteFolder}
                </span>
              </div>
            );
          }
          if (act.type === "mergeFolders") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Combine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>{copy.ai.agent.mergeFolders.replace("{count}", act.sourceFolderIds.length.toString())}</span>
              </div>
            );
          }
          if (act.type === "createNote") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FilePlus2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {copy.ai.agent.createNote.split("{title}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{act.title}</strong>}
                      {part}
                    </span>
                  ))}
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
                    ? copy.ai.agent.renameNote.split("{title}").map((part, i) => (
                        <span key={i}>
                          {i > 0 && act.title}
                          {part}
                        </span>
                      ))
                    : copy.ai.agent.updateNote}
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
                  .map((nid) => notes.find((n) => n.id === nid)?.title || copy.ai.agent.untitled)
                  .join(", ")
              : "";
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <FolderInput className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {targetFolderName ? (
                    copy.ai.agent.moveNotesToFolder.split("{folder}").map((part, i) => (
                      <span key={i}>
                        {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{targetFolderName}</strong>}
                        {part.replace("{count}", notesCount.toString())}
                      </span>
                    ))
                  ) : (
                    copy.ai.agent.removeNotesFolder.replace("{count}", notesCount.toString())
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
                  {copy.ai.agent.mergeNotes.split("{title}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{act.title}</strong>}
                      {part.replace("{count}", act.noteIds.length.toString())}
                    </span>
                  ))}
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
                    ? copy.ai.agent.trashNotes
                    : act.type === "restoreNotes"
                    ? copy.ai.agent.restoreNotes
                    : copy.ai.agent.deleteNotes}
                </span>
              </div>
            );
          }
          if (act.type === "archiveNotes" || act.type === "unarchiveNotes") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {act.type === "archiveNotes" ? copy.ai.agent.archiveNotes : copy.ai.agent.unarchiveNotes}
                </span>
              </div>
            );
          }
          if (act.type === "addTagsToNotes" || act.type === "removeTagsFromNotes") {
            const notesCount = act.noteIds?.length ?? 0;
            const tagsList = act.tags?.join(", ") ?? "";
            const template = act.type === "addTagsToNotes" ? copy.ai.agent.addTagsToNotes : copy.ai.agent.removeTagsFromNotes;
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {template.split("{tags}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{tagsList}</strong>}
                      {part.replace("{count}", notesCount.toString())}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          if (act.type === "createStructuredIdeaNote") {
            return (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {copy.ai.agent.createStructuredIdeaNote.split("{title}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong className="font-semibold text-violet-700 dark:text-violet-400">{act.title}</strong>}
                      {part}
                    </span>
                  ))}
                  <span className="mt-0.5 block text-[10px] text-foreground/45">
                    {copy.ai.agent.saveModeLabel.replace("{mode}", act.saveMode === "human_plus_ai" ? "Human + AI" : "AI only")}
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
            {copy.ai.agent.dangerousActionWarning}
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
                {copy.ai.agent.skip}
              </button>
              {actions.some(isDangerousAction) && !confirmDanger ? (
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-1.5 text-xs font-black text-amber-900 transition hover:bg-amber-200 active:scale-95 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                  type="button"
                  onClick={() => onConfirmDanger(msgId)}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {copy.ai.agent.confirmRisk}
                </button>
              ) : (
                <button
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-violet-600/20 transition hover:bg-violet-500 active:scale-95"
                  type="button"
                  onClick={() => onExecuteActions(msgId, actions)}
                >
                  <Play className="h-3 w-3 fill-current" />
                  {actions.some(isDangerousAction) ? copy.ai.agent.executeDangerous : copy.ai.agent.execute}
                </button>
              )}
            </div>
          )}

          {actionsStatus === "running" && (
            <div className="flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{copy.ai.agent.applying}</span>
            </div>
          )}

          {actionsStatus === "completed" && (
            <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-200" />
              <span>{copy.ai.agent.done}</span>
            </div>
          )}

          {actionsStatus === "error" && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{actionError || copy.ai.agent.error}</span>
              <button
                className="ml-2 underline font-black hover:text-rose-800 dark:hover:text-rose-300"
                type="button"
                onClick={() => onExecuteActions(msgId, actions)}
              >
                {copy.ai.agent.retry}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
