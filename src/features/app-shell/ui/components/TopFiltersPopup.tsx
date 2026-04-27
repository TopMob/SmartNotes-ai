import type { Folder as FolderEntity } from "@/entities/folder";
import type { NotesSort } from "@/features/notes/model/note-selectors";

const sortOptions: Array<{ label: string; value: NotesSort }> = [
  { label: "По времени", value: "updated" },
  { label: "AI relevance", value: "ai_relevance" },
  { label: "Важность", value: "importance" },
  { label: "Алфавит", value: "alphabet" },
];

type TopFiltersPopupProps = {
  notesFilter: { sort: NotesSort; folders: Array<string | null>; tags: string[]; updatedWindowDays: number | null };
  folders: FolderEntity[];
  tagDraft: string;
  tagSuggestions: string[];
  onSetNotesSort: (sort: NotesSort) => void;
  onToggleFolderFilter: (folderId: string | null) => void;
  onToggleTagFilter: (tag: string) => void;
  onSetUpdatedWindowDays: (days: number | null) => void;
  onResetFilters: () => void;
  onTagDraftChange: (value: string) => void;
};

export function TopFiltersPopup({ notesFilter, folders, tagDraft, tagSuggestions, onSetNotesSort, onToggleFolderFilter, onToggleTagFilter, onSetUpdatedWindowDays, onResetFilters, onTagDraftChange }: TopFiltersPopupProps) {
  return (
    <section className="filter-menu pointer-events-auto fixed left-1/2 top-[5.75rem] z-30 w-[min(calc(100vw-1rem),24rem)] max-h-[calc(100dvh-6.75rem)] -translate-x-1/2 overflow-y-auto rounded-[1.4rem] border border-border bg-surface/96 p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl sm:top-[6rem] sm:w-[min(calc(100vw-2rem),24rem)] sm:max-h-[min(70vh,42rem)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/54">Фильтры</h2>
        <button className="rounded-full border border-border bg-surface-strong px-3 py-1.5 text-xs font-bold" onClick={onResetFilters} type="button">Сбросить</button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {sortOptions.map((option) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.sort === option.value ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={option.value} onClick={() => onSetNotesSort(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">{[7, 30, null].map((days) => (<button className={`rounded-2xl border px-3 py-2 text-center text-sm font-bold ${notesFilter.updatedWindowDays === days ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={String(days)} onClick={() => onSetUpdatedWindowDays(days)} type="button">{days === null ? "За все время" : `${days} дней`}</button>))}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.folders.includes(null) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} onClick={() => onToggleFolderFilter(null)} type="button">
          Без папки
        </button>
        {folders.map((folder) => (
          <button className={`rounded-full border px-3 py-2 text-sm font-bold ${notesFilter.folders.includes(folder.id) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-strong"}`} key={folder.id} onClick={() => onToggleFolderFilter(folder.id)} type="button">
            {folder.name}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-surface-strong p-3">
        <label className="block text-sm font-bold text-foreground/66">Тег</label>
        <input className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none" onChange={(event) => onTagDraftChange(event.target.value)} placeholder="Начни вводить тег" value={tagDraft} />
        {tagSuggestions.length ? <div className="mt-3 flex flex-wrap justify-center gap-2">{tagSuggestions.map((tag) => <button className={`rounded-full border px-3 py-1.5 text-sm font-bold ${notesFilter.tags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={tag} onClick={() => onToggleTagFilter(tag)} type="button">#{tag}</button>)}</div> : <p className="mt-3 text-sm text-foreground/52">Совпадений пока нет.</p>}
        {tagDraft.trim() ? <button className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold" onClick={() => onToggleTagFilter(tagDraft.trim())} type="button">Применить тег `#{tagDraft.trim()}`</button> : null}
      </div>
    </section>
  );
}
