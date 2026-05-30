export const queryKeys = {
  notes: (userId: string) => ["notes", userId] as const,
  noteDetail: (userId: string, noteId: string) => ["note-detail", userId, noteId] as const,
  folders: (userId: string) => ["folders", userId] as const,
  settings: (userId: string) => ["settings", userId] as const,
};
