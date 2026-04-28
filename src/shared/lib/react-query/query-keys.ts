export const queryKeys = {
  notes: (userId: string) => ["notes", userId] as const,
  folders: (userId: string) => ["folders", userId] as const,
  settings: (userId: string) => ["settings", userId] as const,
};
