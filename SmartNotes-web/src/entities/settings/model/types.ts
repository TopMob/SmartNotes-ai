export type ThemePreset = "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";

export type CustomThemePreset = {
  id: string;
  name: string;
  preset: ThemePreset;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  uiOpacity: number;
  cardsOpacity: number;
};

export type EditorToolKey =
  | "toolbarVisible"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bullets"
  | "numbered"
  | "hr"
  | "alignText"
  | "alignMedia"
  | "clearFormat"
  | "undoRedo"
  | "links"
  | "pages"
  | "inlineTags";

export type EditorSettings = Record<EditorToolKey, boolean>;

export type InterfaceSettings = {
  showSavedFilters: boolean;
  showTagFilter: boolean;
  showUpdatedPeriodFilter: boolean;
};

export type UserSettings = {
  id: string;
  preset: ThemePreset;
  lang: "ru" | "en";
  folderViewMode: "compact" | "full";
  notesPerPage: number;
  reduceMotion: boolean;
  uiOpacity: number;
  cardsOpacity: number;
  mainBackgroundUrl: string | null;
  sidebarBackgroundUrl: string | null;
  customPresets: CustomThemePreset[];
  editor: EditorSettings;
  interface: InterfaceSettings;
  createdAt: string;
  updatedAt: string;
};

export type UserSettingsPatch = Partial<Omit<UserSettings, "id" | "createdAt" | "updatedAt">>;
