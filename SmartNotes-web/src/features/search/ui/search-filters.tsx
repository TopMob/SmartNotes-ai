"use client";

import { useSearchStore, SortField } from "../model/search-store";

export function SearchFilters() {
  const {
    query, setQuery,
    sort, setSort,
    tags, setTags,
    updatedWindowDays, setUpdatedWindowDays,
    showSavedFilters: _showSavedFilters, showTagFilter, showUpdatedPeriodFilter, toggleVisibility,
    resetFilters
  } = useSearchStore();

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-surface">
      <input
        type="search"
        autoComplete="off"
        name="filters_search_query"
        id="filters_search_query"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск..."
        className="w-full rounded-xl border border-border bg-surface-strong px-4 py-2 text-sm"
      />

      <div className="flex items-center gap-2 overflow-x-auto text-sm">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortField)}
          className="rounded-lg border border-border bg-surface-strong px-3 py-1.5"
        >
          <option value="updatedAt">По дате обновления</option>
          <option value="relevance">По AI relevance</option>
          <option value="importance">По важности</option>
          <option value="alphabetical">По алфавиту</option>
          <option value="textLength">По длине текста</option>
          <option value="manual">Ручная сортировка</option>
        </select>

        <button onClick={() => toggleVisibility("showTagFilter")} className="rounded-lg border border-border px-3 py-1.5">
          Теги
        </button>
        <button onClick={() => toggleVisibility("showUpdatedPeriodFilter")} className="rounded-lg border border-border px-3 py-1.5">
          Период
        </button>
        <button onClick={resetFilters} className="text-rose-500 px-2 font-medium">Сбросить</button>
      </div>

      {showTagFilter && (
        <div className="text-sm">
          <input
            type="text"
            placeholder="Фильтр по тегам (через запятую)..."
            value={tags.join(", ")}
            onChange={(e) => setTags(e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
            className="w-full rounded-lg border border-border bg-surface-strong px-3 py-1.5"
          />
        </div>
      )}

      {showUpdatedPeriodFilter && (
        <div className="flex gap-2 text-sm">
           <button onClick={() => setUpdatedWindowDays(1)} className={`rounded-lg px-3 py-1.5 ${updatedWindowDays === 1 ? "bg-accent text-accent-foreground" : "border border-border"}`}>24ч</button>
           <button onClick={() => setUpdatedWindowDays(7)} className={`rounded-lg px-3 py-1.5 ${updatedWindowDays === 7 ? "bg-accent text-accent-foreground" : "border border-border"}`}>7 дней</button>
           <button onClick={() => setUpdatedWindowDays(30)} className={`rounded-lg px-3 py-1.5 ${updatedWindowDays === 30 ? "bg-accent text-accent-foreground" : "border border-border"}`}>30 дней</button>
           <button onClick={() => setUpdatedWindowDays(null)} className={`rounded-lg px-3 py-1.5 ${updatedWindowDays === null ? "bg-accent text-accent-foreground" : "border border-border"}`}>Все время</button>
        </div>
      )}
    </div>
  );
}
