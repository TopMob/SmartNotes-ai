import type { Folder as FolderEntity } from "@/entities/folder";
import type { NotesFilter, NotesSort } from "@/features/notes/model/note-selectors";

const sortOptions: Array<{ label: string; value: NotesSort }> = [
  { label: "По времени", value: "updated" },
  { label: "AI relevance", value: "ai_relevance" },
  { label: "Важность", value: "importance" },
  { label: "Алфавит", value: "alphabet" },
  { label: "Длина текста", value: "text_length" },
  { label: "Ручной порядок", value: "manual" },
];

type TopFiltersPopupProps = {
  popupRef: React.RefObject<HTMLDivElement | null>;
  notesFilter: NotesFilter;
  savedFilters: Array<{ id: string; name: string; filter: NotesFilter }>;
  folders: FolderEntity[];
  tagDraft: string;
  tagSuggestions: string[];
  onApplySavedFilter: (id: string) => void;
  onDeleteSavedFilter: (id: string) => void;
  onSaveCurrentFilter: (name: string) => void;
  onSetNotesSort: (sort: NotesSort) => void;
  onToggleFolderFilter: (folderId: string | null) => void;
  onToggleTagFilter: (tag: string) => void;
  onSetUpdatedWindowDays: (days: number | null) => void;
  onResetFilters: () => void;
  onTagDraftChange: (value: string) => void;
  visibleSections?: {
    savedFilters: boolean;
    tagFilter: boolean;
    updatedPeriodFilter: boolean;
  };
};

export function TopFiltersPopup({ popupRef, notesFilter, savedFilters, folders, tagDraft, tagSuggestions, onApplySavedFilter, onDeleteSavedFilter, onSaveCurrentFilter, onSetNotesSort, onToggleFolderFilter, onToggleTagFilter, onSetUpdatedWindowDays, onResetFilters, onTagDraftChange, visibleSections = { savedFilters: true, tagFilter: true, updatedPeriodFilter: true } }: TopFiltersPopupProps) {
  function saveFilter() {
    const name = window.prompt("Название фильтра", "Мой фильтр")?.trim();

    if (!name) {
      return;
    }

    onSaveCurrentFilter(name);
  }

  return (
    <section ref={popupRef} className="filter-menu pointer-events-auto fixed left-1/2 top-[5.75rem] z-30 w-[min(calc(100vw-1rem),24rem)] max-h-[78dvh] -translate-x-1/2 overflow-y-auto rounded-[1.4rem] border border-border bg-surface/96 p-3 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl sm:top-[6rem] sm:w-[min(calc(100vw-2rem),24rem)] sm:max-h-[min(70vh,42rem)] sm:p-4 lg:left-auto lg:right-6 lg:top-24 lg:translate-x-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/54">Фильтры</h2>
        <div className="flex gap-2">
          <button className="rounded-full border border-border bg-surface-strong px-3 py-1.5 text-xs font-bold" onClick={saveFilter} type="button">Сохранить</button>
          <button className="rounded-full border border-border bg-surface-strong px-3 py-1.5 text-xs font-bold" onClick={onResetFilters} type="button">Сбросить</button>
        </div>
      </div>
      {visibleSections.savedFilters && savedFilters.length ? (
        <div className="mb-3 rounded-2xl border border-border bg-surface-strong p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-foreground/42">Сохраненные</div>
          <div className="grid gap-2">
            {savedFilters.map((filter) => (
              <div className="flex items-center gap-2" key={filter.id}>
                <button className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2 text-left text-sm font-bold" onClick={() => onApplySavedFilter(filter.id)} type="button">{filter.name}</button>
                <button className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-rose-500" onClick={() => onDeleteSavedFilter(filter.id)} type="button">×</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-center gap-1.5">
        {sortOptions.map((option) => (
          <button className={`rounded-full border px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-bold transition-all duration-200 ${notesFilter.sort === option.value ? "border-accent bg-accent text-accent-foreground font-black shadow-md shadow-accent/10" : "border-border bg-surface-strong text-foreground/72 hover:border-foreground/20"}`} key={option.value} onClick={() => onSetNotesSort(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
      {visibleSections.updatedPeriodFilter ? <div className="mt-3 flex flex-wrap justify-center gap-1.5">{[7, 30, null].map((days) => (<button className={`rounded-2xl border px-2.5 py-1.5 text-center text-xs sm:px-3 sm:py-2 sm:text-sm font-bold transition-all duration-200 ${notesFilter.updatedWindowDays === days ? "border-accent bg-accent text-accent-foreground font-black shadow-md shadow-accent/10" : "border-border bg-surface-strong text-foreground/72 hover:border-foreground/20"}`} key={String(days)} onClick={() => onSetUpdatedWindowDays(days)} type="button">{days === null ? "За все время" : `${days} дней`}</button>))}</div> : null}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        <button className={`rounded-full border px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-bold transition-all duration-200 ${notesFilter.folders.includes(null) ? "border-accent bg-accent text-accent-foreground font-black shadow-md shadow-accent/10" : "border-border bg-surface-strong text-foreground/72 hover:border-foreground/20"}`} onClick={() => onToggleFolderFilter(null)} type="button">
          Без папки
        </button>
        {folders.map((folder) => (
          <button className={`rounded-full border px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-bold transition-all duration-200 ${notesFilter.folders.includes(folder.id) ? "border-accent bg-accent text-accent-foreground font-black shadow-md shadow-accent/10" : "border-border bg-surface-strong text-foreground/72 hover:border-foreground/20"}`} key={folder.id} onClick={() => onToggleFolderFilter(folder.id)} type="button">
            {folder.name}
          </button>
        ))}
      </div>
      {visibleSections.tagFilter ? <div className="mt-3 rounded-2xl border border-border bg-surface-strong p-3">
        <label className="block text-sm font-bold text-foreground/66">Теги</label>
        <input className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none transition-all focus:border-accent" onChange={(event) => onTagDraftChange(event.target.value)} placeholder="Начни вводить тег" value={tagDraft} />
        
        {notesFilter.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {notesFilter.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-sm shadow-accent/10">
                #{tag}
                <button
                  type="button"
                  onClick={() => onToggleTagFilter(tag)}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 focus:outline-none font-bold"
                  aria-label={`Убрать тег ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {tagSuggestions.length ? <div className="mt-3 flex flex-wrap justify-center gap-1.5">{tagSuggestions.map((tag) => <button className={`rounded-full border px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-bold transition-all duration-200 ${notesFilter.tags.includes(tag) ? "border-accent bg-accent text-accent-foreground font-black shadow-md shadow-accent/10" : "border-border bg-background text-foreground/72 hover:border-foreground/20"}`} key={tag} onClick={() => onToggleTagFilter(tag)} type="button">#{tag}</button>)}</div> : <p className="mt-3 text-sm text-foreground/52">Совпадений пока нет.</p>}
        {tagDraft.trim() ? <button className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold hover:bg-surface" onClick={() => onToggleTagFilter(tagDraft.trim())} type="button">Применить тег `#{tagDraft.trim()}`</button> : null}
      </div> : null}
    </section>
  );
}
