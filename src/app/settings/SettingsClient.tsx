"use client";

import {
  ArrowLeft,
  Check,
  Database,
  Download,
  FileJson,
  Palette,
  Plus,
  RotateCcw,
  Upload,
  SlidersHorizontal,
  Type,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { CustomThemePreset, EditorToolKey } from "@/entities/settings";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { parseImportedNotesFile } from "@/features/notes/lib/note-import";
import { useSettingsActions } from "@/features/settings/hooks/use-settings-mutations";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { publish } from "@/services/event-bus";
import { downloadTextFile, safeFileName } from "@/features/app-shell/ui/components/shared";
import { getUiCopy } from "@/shared/lib/i18n";
import { useUiStore } from "@/shared/store/ui-store";
import { isAdminUser } from "@/features/auth/lib/admin-acl";

import { Panel } from "./components/Panel";
import { SectionIntro } from "./components/SectionIntro";

const sections = [
  { id: "appearance", icon: Palette },
  { id: "editor", icon: Type },
  { id: "filters", icon: SlidersHorizontal },
  { id: "data", icon: Database },
  { id: "profile", icon: UserRound },
] as const;

const themePresets = ["paper", "smarthub", "smartlib", "cyber", "lego", "classic"] as const;

type SettingsClientProps = {
  initialDriveConnected: boolean;
};

export default function SettingsClient({ initialDriveConnected }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const [presetName, setPresetName] = useState("");
  const { data: settings, isLoading: _isLoading, error } = useSettingsQuery();
  const { data: folders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const user = useAuthStore((state) => state.user);
  const developerMode = useUiStore((s) => s.developerMode);
  
  const [driveConnected, setDriveConnected] = useState(initialDriveConnected);
  const [gdriveDisabled, setGdriveDisabled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("smartnotes:disable-google-drive") === "true";
    }
    return false;
  });

  function handleToggleGoogleDrive() {
    const nextVal = !gdriveDisabled;
    setGdriveDisabled(nextVal);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("smartnotes:disable-google-drive", String(nextVal));
    }
  }
  
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");
  const { createNote } = useNoteActions();
  const { patchSettings, resetSettings } = useSettingsActions();
  const { updateProfile, pending: profilePending, loginWithGoogle, connectGoogleDrive, logout, resetPassword } = useAuthActions();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? "");
  const [uidCopied, setUidCopied] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);

  const editorGroups = useMemo(
    () => [
      ["toolbarVisible", lang === "ru" ? "Тулбар форматирования" : "Formatting toolbar"],
      ["bold", lang === "ru" ? "Жирный шрифт" : "Bold text"],
      ["italic", lang === "ru" ? "Курсив" : "Italic text"],
      ["underline", lang === "ru" ? "Подчеркнутый шрифт" : "Underline text"],
      ["strike", lang === "ru" ? "Зачеркнутый шрифт" : "Strikethrough text"],
      ["bullets", lang === "ru" ? "Маркированный список" : "Bullet list"],
      ["numbered", lang === "ru" ? "Нумерация списков" : "Numbered list"],
      ["hr", lang === "ru" ? "Разделительная линия" : "Horizontal divider"],
      ["alignText", lang === "ru" ? "Выравнивание текста" : "Text alignment"],
      ["alignMedia", lang === "ru" ? "Выравнивание медиа" : "Media alignment"],
      ["clearFormat", lang === "ru" ? "Очистить форматирование" : "Clear formatting"],
      ["undoRedo", lang === "ru" ? "Отмена / Повтор (Undo / Redo)" : "Undo / Redo controls"],
      ["links", lang === "ru" ? "Вставка ссылок" : "Insert links"],
      ["pages", lang === "ru" ? "Многостраничность заметки" : "Note pages"],
      ["inlineTags", lang === "ru" ? "Тегирование (Inline tags)" : "Inline tag chips"],
    ] as const,
    [lang],
  );

  if (!settings) {
    return (
      <main className="min-h-screen px-4 py-4 sm:px-6 lg:p-6">
        <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-border bg-surface p-6 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
          <h1 className="text-xl font-black">{copy.settings.title}</h1>
          <p className="mt-2 text-sm text-foreground/64">
            {error instanceof Error ? error.message : "Не удалось загрузить настройки."}
          </p>
        </div>
      </main>
    );
  }

  const settingsData = settings;

  function toggleInterfaceSection(key: keyof typeof settingsData.interface) {
    void patchSettings({
      interface: {
        ...settingsData.interface,
        [key]: !settingsData.interface[key],
      },
    });
  }

  function toggleEditorTool(key: EditorToolKey) {
    void patchSettings({
      editor: {
        ...settingsData.editor,
        [key]: !settingsData.editor[key],
      },
    });
  }

  function saveCurrentThemePreset(name: string) {
    if (!name.trim()) {
      return;
    }

    const nextPreset: CustomThemePreset = {
      id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      preset: settingsData.preset,
      mainBackgroundUrl: settingsData.mainBackgroundUrl,
      sidebarBackgroundUrl: settingsData.sidebarBackgroundUrl,
      uiOpacity: settingsData.uiOpacity,
      cardsOpacity: settingsData.cardsOpacity,
    };

    void patchSettings({
      customPresets: [...settingsData.customPresets.filter((item) => item.name !== nextPreset.name).slice(-5), nextPreset],
    });
  }

  function applyCustomPreset(id: string) {
    const preset = settingsData.customPresets.find((item) => item.id === id);

    if (!preset) {
      return;
    }

    void patchSettings({
      preset: preset.preset,
      mainBackgroundUrl: preset.mainBackgroundUrl,
      sidebarBackgroundUrl: preset.sidebarBackgroundUrl,
      uiOpacity: preset.uiOpacity,
      cardsOpacity: preset.cardsOpacity,
    });
  }

  function removeCustomPreset(id: string) {
    void patchSettings({
      customPresets: settingsData.customPresets.filter((item) => item.id !== id),
    });
  }

  async function uploadBackground(target: "mainBackgroundUrl" | "sidebarBackgroundUrl") {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.onchange = async () => {
      const file = picker.files?.[0];

      if (!file) {
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл."));
        reader.readAsDataURL(file);
      });

      void patchSettings({ [target]: dataUrl });
    };
    picker.click();
  }

  async function handleImportNotes() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.onchange = async () => {
      const file = picker.files?.[0];

      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const importedNotes = parseImportedNotesFile(text, userId);

        for (const importedNote of importedNotes) {
          await createNote(
            {
              title: importedNote.title,
              content: importedNote.content,
              folderId: importedNote.folderId,
              userTags: importedNote.userTags,
            },
            userId,
            importedNote,
          );
          publish("noteImported", { noteId: importedNote.id, title: importedNote.title });
        }

        window.alert(`Импортировано заметок: ${importedNotes.length}`);
      } catch (importError) {
        window.alert(importError instanceof Error ? importError.message : "Не удалось импортировать заметки.");
      }
    };
    picker.click();
  }

  function exportAllNotes() {
    const exportable = notes.filter((note) => !note.lock?.hidden);

    downloadTextFile(
      `smartnotes-all-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: exportable }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportFolderNotes() {
    const visibleFolders = folders.filter((folder) => !folder.trashedAt);
    const folderName = window.prompt(
      visibleFolders.length ? `Название папки для экспорта:\n${visibleFolders.map((folder) => `• ${folder.name}`).join("\n")}` : "Пока нет папок для экспорта.",
    )?.trim();

    if (!folderName) {
      return;
    }

    const folder = visibleFolders.find((item) => item.name.toLocaleLowerCase() === folderName.toLocaleLowerCase());

    if (!folder) {
      window.alert("Папка не найдена. Введите название папки из списка.");
      return;
    }

    const folderId = folder.id;
    const exportable = notes.filter((note) => note.folderId === folderId && !note.lock?.hidden);

    downloadTextFile(
      `${safeFileName(`smartnotes-folder-${folder.name}`)}.json`,
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), folderId, folderName: folder.name, notes: exportable }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function copyUid() {
    const uid = user?.id ?? "";
    void navigator.clipboard.writeText(uid).then(() => {
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    });
  }

  async function handleSaveProfile() {
    await updateProfile({
      displayName: displayName.trim() || undefined,
      photoURL: avatarUrl.trim() || null,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function uploadAvatar() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл."));
        reader.readAsDataURL(file);
      });
      setAvatarUrl(dataUrl);
    };
    picker.click();
  }

  async function handleDisconnectDrive() {
    if (!window.confirm(lang === "ru" ? "Вы уверены, что хотите отключить Google Диск?" : "Are you sure you want to disconnect Google Drive?")) {
      return;
    }

    try {
      const response = await fetch("/api/media/google-drive/disconnect", { method: "POST" });
      if (response.ok) {
        setDriveConnected(false);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (err) {
      window.alert(lang === "ru" ? "Не удалось отключить Диск." : "Failed to disconnect Drive.");
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:p-6 pb-24">
      <div className="mx-auto grid max-w-7xl min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] pb-12">
        <aside className="app-surface rounded-[1.6rem] min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:sticky lg:top-6 lg:self-start">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            {copy.common.back}
          </Link>

          <h1 className="mt-5 text-2xl lg:text-3xl font-black tracking-tight">{copy.settings.title}</h1>

          <nav className="mt-6 flex w-full max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-2 no-scrollbar lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {sections.map((section) => {
              const Icon = section.icon;
              const label = copy.settings.sections[section.id];

              return (
                <button
                  className={`shrink-0 flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-left whitespace-nowrap transition lg:w-full sm:min-w-[10rem] sm:p-3 ${activeSection === section.id ? "bg-foreground text-background" : "hover:bg-surface-strong"}`}
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  type="button"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-xs sm:text-sm font-black">{label}</span>
                </button>
              );
            })}
          </nav>

          {developerMode && isAdminUser(user?.email) ? (
            <div className="mt-4 w-full min-w-0 rounded-[1.4rem] border border-border bg-surface-strong p-3 text-xs text-foreground/62 sm:mt-6 sm:p-4 sm:text-sm">
              <p className="font-black text-foreground">{copy.settings.appearance.pendingSync}</p>
              <p className="mt-2">{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") : copy.settings.appearance.noPendingSync}</p>
            </div>
          ) : null}
        </aside>

        <section className="app-surface rounded-[1.6rem] min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7">
          {activeSection === "appearance" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.appearance.title} text={copy.settings.appearance.subtitle} />
              <Panel title={copy.settings.appearance.themePresets}>
                <div className="flex flex-wrap gap-2">
                  {themePresets.map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm ${settings.preset === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ preset: item })} type="button">
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex w-full min-w-0 flex-col overflow-hidden text-sm font-bold text-foreground/72">
                    {lang === "ru" ? `Прозрачность интерфейса: ${settings.uiOpacity.toFixed(2)}` : `UI opacity: ${settings.uiOpacity.toFixed(2)}`}
                    <input className="mt-2 w-full min-w-0" max="1" min="0.4" onChange={(event) => void patchSettings({ uiOpacity: Number(event.target.value) })} step="0.02" type="range" value={settings.uiOpacity} />
                  </label>
                  <label className="flex w-full min-w-0 flex-col overflow-hidden text-sm font-bold text-foreground/72">
                    {lang === "ru" ? `Прозрачность карточек: ${settings.cardsOpacity.toFixed(2)}` : `Cards opacity: ${settings.cardsOpacity.toFixed(2)}`}
                    <input className="mt-2 w-full min-w-0" max="1" min="0.4" onChange={(event) => void patchSettings({ cardsOpacity: Number(event.target.value) })} step="0.02" type="range" value={settings.cardsOpacity} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <span className="text-sm font-bold text-foreground/72">{copy.settings.appearance.mainBackgroundUrl}</span>
                    <div className="flex gap-2">
                      <input className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-normal" onChange={(event) => void patchSettings({ mainBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.mainBackgroundUrl ?? ""} />
                      <button className="shrink-0 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("mainBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                    </div>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <span className="text-sm font-bold text-foreground/72">{copy.settings.appearance.sidebarBackgroundUrl}</span>
                    <div className="flex gap-2">
                      <input className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-normal" onChange={(event) => void patchSettings({ sidebarBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.sidebarBackgroundUrl ?? ""} />
                      <button className="shrink-0 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("sidebarBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.localeAndLayout}>
                <div className="flex flex-wrap gap-2">
                  {(["ru", "en"] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm ${settings.lang === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ lang: item })} type="button">
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {([5, 10, 20, 50] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm ${settings.notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ notesPerPage: item })} type="button">
                      {lang === "ru" ? `${item} на стр.` : `${item} / page`}
                    </button>
                  ))}
                </div>
                <button className={`mt-4 min-h-11 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm ${settings.reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} onClick={() => void patchSettings({ reduceMotion: !settings.reduceMotion })} type="button">
                  {lang === "ru" ? `Упрощенные анимации: ${settings.reduceMotion ? "Вкл" : "Выкл"}` : `Reduce motion: ${settings.reduceMotion ? "On" : "Off"}`}
                </button>
              </Panel>

              <Panel title={copy.settings.appearance.customPresets}>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <input className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm sm:min-w-[16rem] sm:flex-1" onChange={(event) => setPresetName(event.target.value)} placeholder={copy.settings.appearance.customPresets} value={presetName} />
                  <button className="w-full min-h-11 rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground sm:w-auto transition hover:bg-accent/90" onClick={() => { saveCurrentThemePreset(presetName); setPresetName(""); }} type="button">
                    {copy.settings.appearance.savePreset}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold sm:w-auto transition hover:bg-surface-strong" onClick={() => void resetSettings()} type="button">
                    {copy.settings.appearance.resetAppearance}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {settings.customPresets.length ? (
                    settings.customPresets.map((item) => (
                      <div className="rounded-[1.3rem] border border-border bg-surface-strong p-4" key={item.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{item.name}</p>
                            <p className="mt-1 text-xs text-foreground/52">{item.preset}</p>
                          </div>
                          <button className="rounded-full bg-background h-11 w-11 flex items-center justify-center text-foreground/60 hover:bg-surface-strong transition" onClick={() => removeCustomPreset(item.id)} type="button">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                        <button className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground transition hover:bg-accent/90" onClick={() => applyCustomPreset(item.id)} type="button">
                          {copy.common.apply}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.3rem] border border-dashed border-border bg-surface-strong p-4 text-sm text-foreground/56">{copy.settings.appearance.noCustomPresets}</div>
                  )}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === "editor" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.editor.title} text={copy.settings.editor.subtitle} />
              <Panel title={copy.settings.editor.tools}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {editorGroups.map(([key, label]) => (
                    <button className={`flex w-full min-w-0 min-h-11 items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm transition hover:bg-surface-strong ${settings.editor[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleEditorTool(key)} type="button">
                      <span className="truncate pr-3">{label}</span>
                      <span>{settings.editor[key] ? copy.settings.editor.on : copy.settings.editor.off}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === "filters" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.filters.title} text={copy.settings.filters.subtitle} />
              <Panel title={copy.settings.filters.sections}>
                <div className="space-y-2">
                  {([
                    ["showSavedFilters", copy.settings.filters.savedFilters],
                    ["showTagFilter", copy.settings.filters.tagFilter],
                    ["showUpdatedPeriodFilter", copy.settings.filters.updatedPeriodFilter],
                  ] as const).map(([key, label]) => (
                    <button className={`flex w-full min-w-0 min-h-11 items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong ${settings.interface[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleInterfaceSection(key)} type="button">
                      <span className="truncate pr-3">{label}</span>
                      <span>{settings.interface[key] ? copy.common.on : copy.common.off}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === "data" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.data.title} text={copy.settings.data.subtitle} />
              <Panel title={copy.settings.data.maintenance}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void handleImportNotes()} type="button">
                    <Upload className="h-4 w-4" />
                    {copy.settings.data.importJson}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={exportAllNotes} type="button">
                    <Download className="h-4 w-4" />
                    {copy.settings.data.exportAll}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={exportFolderNotes} type="button">
                    <FileJson className="h-4 w-4" />
                    {copy.settings.data.exportFolder}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => window.location.reload()} type="button">
                    {copy.settings.data.resetCache}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground sm:text-sm transition hover:bg-accent/90" onClick={() => void resetSettings()} type="button">
                    {copy.settings.data.resetSettings}
                  </button>
                </div>
              </Panel>

              <Panel title={lang === "ru" ? "Облачное хранилище медиафайлов" : "Cloud Media Storage"}>
                <div className="rounded-[1.2rem] border border-border bg-surface-strong p-4 text-sm text-foreground/58 space-y-4">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-[0.18em] text-foreground/42">
                      {lang === "ru" ? "Основное хранилище (Supabase Storage)" : "Default Storage (Supabase Storage)"}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-emerald-500">
                      {lang === "ru" 
                        ? "✓ Активно (Изображения сохраняются в Supabase Storage и сжимаются до 500KB)" 
                        : "✓ Active (Images are saved in Supabase Storage and compressed to 500KB)"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                      {lang === "ru"
                        ? "Каждому пользователю предоставляется бесплатное защищённое хранилище объёмом до 1 ГБ. Все медиафайлы автоматически оптимизируются для экономии места."
                        : "Each user gets up to 1 GB of secure storage free of charge. All media assets are automatically optimized to conserve storage capacity."}
                    </p>
                  </div>

                  <div className="h-px bg-border" />

                  <div>
                    <span className="block text-xs font-black uppercase tracking-[0.18em] text-foreground/42">
                      {lang === "ru" ? "Дополнительно: Google Диск (BYOS)" : "Optional: Google Drive (BYOS)"}
                    </span>

                    <p className="mt-2 text-sm font-medium text-foreground">
                      {lang === "ru" ? "Статус интеграции: " : "Integration Status: "}
                      {gdriveDisabled ? (
                        <span className="text-amber-500">{lang === "ru" ? "Отключена пользователем" : "Disabled by user"}</span>
                      ) : driveConnected ? (
                        <span className="text-emerald-500">{lang === "ru" ? "Подключено (Изображения сохраняются на ваш Google Диск)" : "Connected (Images are saved to your Google Drive)"}</span>
                      ) : (
                        <span className="text-foreground/48">{lang === "ru" ? "Не подключено" : "Not connected"}</span>
                      )}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                      {lang === "ru"
                        ? "Концепция BYOS (Bring Your Own Storage) позволяет загружать все изображения напрямую в ваш личный Google Drive. При возникновении проблем с авторизацией Google вы можете временно отключить интеграцию ниже."
                        : "The BYOS concept lets you upload photos directly to your personal Google Drive account. If you encounter Google OAuth issues, you can disable the integration below."}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {driveConnected && !gdriveDisabled && (
                        <button
                          onClick={() => void handleDisconnectDrive()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition text-xs font-bold px-4 py-2"
                          type="button"
                        >
                          {lang === "ru" ? "Отключить аккаунт Google" : "Disconnect Google Account"}
                        </button>
                      )}
                      
                      {!driveConnected && (
                        <button
                          onClick={() => void connectGoogleDrive()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition hover:bg-accent/90"
                          type="button"
                        >
                          {lang === "ru" ? "Подключить Google Диск" : "Connect Google Drive"}
                        </button>
                      )}

                      <button
                        onClick={handleToggleGoogleDrive}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                          gdriveDisabled 
                            ? "border-accent bg-accent/10 text-accent" 
                            : "border-border bg-background hover:bg-surface-strong text-foreground/72"
                        }`}
                        type="button"
                      >
                        {gdriveDisabled 
                          ? (lang === "ru" ? "Включить интеграцию с Диском" : "Enable Drive Integration")
                          : (lang === "ru" ? "Отключить интеграцию с Диском" : "Disable Drive Integration")}
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === "profile" ? (
            <div className="space-y-6">
              <SectionIntro title={copy.settings.profile.title} text={copy.settings.profile.subtitle} />

              <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Details Panel */}
                <Panel title={copy.settings.profile.profileDetails || "Данные профиля"}>
                  <div className="space-y-4">
                    {/* Avatar preview & Upload */}
                    <div className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-surface-strong border border-border sm:flex-row">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-background text-2xl font-black text-foreground/45 shadow-inner">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
                        ) : (
                          <span>{(displayName || user?.email || "?").slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <button
                          className="w-full inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent/90 transition shadow-sm"
                          onClick={() => void uploadAvatar()}
                          type="button"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {copy.settings.profile.uploadAvatarLabel || "Загрузить аватар"}
                        </button>
                        {avatarUrl ? (
                          <button
                            className="w-full text-center text-xs font-bold text-rose-500 hover:text-rose-600 transition min-h-9 flex items-center justify-center border border-rose-500/20 rounded-xl bg-rose-500/5 hover:bg-rose-500/10"
                            onClick={() => setAvatarUrl("")}
                            type="button"
                          >
                            {copy.settings.profile.deleteAvatar || "Удалить аватар"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Avatar URL input */}
                    <div>
                      <span className="block mb-1 text-xs font-bold text-foreground/60">{copy.settings.profile.avatarUrl}</span>
                      <input
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent transition font-normal"
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder={copy.settings.profile.avatarUrlPlaceholder}
                        type="url"
                        value={avatarUrl}
                      />
                    </div>

                    {/* Display name input */}
                    <div>
                      <span className="block mb-1 text-xs font-bold text-foreground/60">{copy.settings.profile.displayName}</span>
                      <input
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent transition font-normal"
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={copy.settings.profile.displayNamePlaceholder}
                        type="text"
                        value={displayName}
                      />
                    </div>

                    {/* Save Button */}
                    <div className="pt-2">
                      <button
                        className={`w-full min-h-11 rounded-2xl px-4 text-sm font-bold transition-all shadow-sm ${profileSaved ? "bg-accent/15 text-accent border border-accent/25" : "bg-accent text-accent-foreground hover:bg-accent/90"}`}
                        disabled={profilePending}
                        onClick={() => void handleSaveProfile()}
                        type="button"
                      >
                        {profilePending
                          ? copy.settings.profile.saving
                          : profileSaved
                            ? copy.settings.profile.saved
                            : copy.settings.profile.saveProfile}
                      </button>
                    </div>
                  </div>
                </Panel>

                {/* Account & Security Panel */}
                <Panel title={copy.settings.profile.securityAndSession || "Безопасность и сессия"}>
                  <div className="space-y-4">
                    {/* Email */}
                    <div>
                      <span className="block mb-1 text-xs font-bold text-foreground/60">{copy.settings.profile.email}</span>
                      <input
                        className="w-full min-h-10 rounded-xl border border-border/80 bg-background/50 px-3 py-1.5 text-xs text-foreground/60 select-all cursor-default font-normal"
                        readOnly
                        value={user?.email ?? "—"}
                      />
                    </div>

                    {/* UID */}
                    <div>
                      <span className="block mb-1 text-xs font-bold text-foreground/60">{copy.settings.profile.uid}</span>
                      <div className="flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background/50 px-3 py-1.5 font-mono text-[10px] text-foreground/60 select-all cursor-default"
                          readOnly
                          value={user?.id ?? "—"}
                        />
                        <button
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${uidCopied ? "border-accent bg-accent/10 text-accent" : "border-border/80 bg-background text-foreground/60 hover:bg-surface-strong"}`}
                          onClick={copyUid}
                          title={copy.settings.profile.copy}
                          type="button"
                        >
                          {uidCopied ? <Check className="h-4 w-4" /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect height="13" rx="2" width="13" x="9" y="9" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Registered / Last login */}
                    {user?.createdAt && (
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-strong border border-border text-[11px] text-foreground/60 font-medium">
                        <div>
                          <span className="block text-[10px] text-foreground/45 uppercase font-bold">{copy.settings.profile.registeredAt || "Дата регистрации"}</span>
                          <span className="mt-0.5 block truncate">
                            {new Date(user.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-foreground/45 uppercase font-bold">{copy.settings.profile.lastLoginAt || "Последний вход"}</span>
                          <span className="mt-0.5 block truncate">
                            {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Reset Password & Log Out Buttons */}
                    <div className="pt-2 flex flex-col gap-2">
                      {user?.email && user.id !== "local-user" && !user.id.startsWith("guest-") && (
                        <button
                          className="w-full min-h-10 rounded-2xl border border-border bg-background hover:bg-surface-strong transition flex items-center justify-center gap-2 text-xs font-bold text-foreground/80 shadow-sm"
                          onClick={async () => {
                            try {
                              await resetPassword(user.email!);
                              window.alert(copy.settings.profile.resetPasswordSuccess || "Ссылка для сброса пароля отправлена на почту!");
                            } catch (e) {
                              window.alert(e instanceof Error ? e.message : "Не удалось отправить ссылку.");
                            }
                          }}
                          type="button"
                        >
                          {copy.settings.profile.resetPassword || "Сбросить пароль"}
                        </button>
                      )}
                      
                      <button
                        className="w-full min-h-10 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 font-bold transition flex items-center justify-center gap-2 text-xs shadow-sm"
                        onClick={() => void logout()}
                        type="button"
                      >
                        {copy.shell.logout || "Выйти из аккаунта"}
                      </button>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
