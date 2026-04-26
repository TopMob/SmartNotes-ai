import type { Note } from "@/entities/note";
import type { AppView } from "@/shared/store/ui-store";
import { normalizeSearchToken } from "@/shared/lib/search";

const ruToEnLayoutMap: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
};

const enToRuLayoutMap = Object.fromEntries(Object.entries(ruToEnLayoutMap).map(([ru, en]) => [en, ru])) as Record<string, string>;

const translitMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ь: "",
  ъ: "",
};

export type NotesSort = "updated" | "ai_relevance" | "importance" | "alphabet" | "text_length" | "manual";

export type NotesFilter = {
  sort: NotesSort;
  folders: Array<string | null>;
  tags: string[];
  updatedWindowDays: number | null;
};

export const DEFAULT_NOTES_FILTER: NotesFilter = {
  sort: "updated",
  folders: [],
  tags: [],
  updatedWindowDays: null,
};

type SelectNotesInput = {
  notes: Note[];
  view: AppView;
  activeFolderId: string | null;
  searchQuery: string;
  filter?: Partial<NotesFilter>;
  now?: Date;
};

function matchesView(note: Note, view: AppView, activeFolderId: string | null) {
  if (view === "trash") {
    return Boolean(note.trashedAt);
  }

  if (note.trashedAt) {
    return false;
  }

  switch (view) {
    case "favorites":
      return note.favorite;
    case "archive":
      return note.isArchived;
    case "folder":
      return note.folderId === activeFolderId;
    case "reminders":
      return Boolean(note.reminderAt);
    case "locked":
      return Boolean(note.lock);
    case "notes":
    case "folders":
    case "hidden_folders":
    case "admin_tools":
      return !note.isArchived;
  }
}

function matchesSearch(note: Note, searchQuery: string) {
  if (!searchQuery.trim()) {
    return true;
  }

  const haystack = [note.title, note.content, ...note.userTags, ...note.hiddenTags, note.resurfacingClass ?? ""]
    .join(" ")
    .toLowerCase()
    .replaceAll("ё", "е");
  const tokens = searchQuery
    .split(/\s+/u)
    .map(normalizeSearchToken)
    .filter(Boolean);

  function remapKeyboardLayout(value: string, map: Record<string, string>) {
    return [...value].map((char) => map[char] ?? char).join("");
  }

  function transliterateRu(value: string) {
    return [...value].map((char) => translitMap[char] ?? char).join("");
  }

  function buildSearchVariants(value: string) {
    return Array.from(new Set([value, remapKeyboardLayout(value, ruToEnLayoutMap), remapKeyboardLayout(value, enToRuLayoutMap), transliterateRu(value)].filter(Boolean)));
  }

  return tokens.every((token) => buildSearchVariants(token).some((variant) => buildSearchVariants(haystack).some((candidate) => candidate.includes(variant))));
}

function matchesFilter(note: Note, filter: NotesFilter, now: Date) {
  const matchesFolder = !filter.folders.length || filter.folders.includes(note.folderId);
  const matchesTags = !filter.tags.length || filter.tags.every((tag) => note.userTags.includes(tag));
  const matchesUpdatedWindow =
    filter.updatedWindowDays === null ||
    now.getTime() - new Date(note.updatedAt).getTime() <= filter.updatedWindowDays * 24 * 60 * 60 * 1000;

  return matchesFolder && matchesTags && matchesUpdatedWindow;
}

function compareByPinned(left: Note, right: Note) {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  return 0;
}

function compareNotes(left: Note, right: Note, sort: NotesSort) {
  const pinnedOrder = compareByPinned(left, right);

  if (pinnedOrder !== 0 && sort !== "manual") {
    return pinnedOrder;
  }

  switch (sort) {
    case "ai_relevance":
      return right.aiRelevance - left.aiRelevance || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    case "importance":
      return Number(right.favorite) - Number(left.favorite) || right.aiRelevance - left.aiRelevance;
    case "alphabet":
      return left.title.localeCompare(right.title);
    case "text_length":
      return right.content.length - left.content.length;
    case "manual":
      return left.order - right.order;
    case "updated":
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }
}

export function selectVisibleNotes(input: SelectNotesInput) {
  const filter = { ...DEFAULT_NOTES_FILTER, ...input.filter };
  const now = input.now ?? new Date();

  return [...input.notes]
    .filter((note) => matchesView(note, input.view, input.activeFolderId))
    .filter((note) => matchesSearch(note, input.searchQuery))
    .filter((note) => matchesFilter(note, filter, now))
    .sort((left, right) => compareNotes(left, right, filter.sort));
}

export function selectPinnedGroups(notes: Note[]) {
  return {
    pinned: notes.filter((note) => note.pinned),
    unpinned: notes.filter((note) => !note.pinned),
  };
}
