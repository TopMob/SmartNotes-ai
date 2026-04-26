import type { Note } from "@/entities/note";
import type { AppView } from "@/shared/store/ui-store";
import { includesSearchTokens } from "@/shared/lib/search";

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

  return includesSearchTokens(
    [note.title, note.content, ...note.userTags, ...note.hiddenTags, note.resurfacingClass ?? ""].join(" "),
    searchQuery,
  );
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
