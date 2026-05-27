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

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const [presetName, setPresetName] = useState("");
  const { data: settings, isLoading: _isLoading, error } = useSettingsQuery();
  const { data: folders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const user = useAuthStore((state) => state.user);
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");
  const { createNote } = useNoteActions();
  const { patchSettings, resetSettings } = useSettingsActions();
  const { updateProfile, pending: profilePending } = useAuthActions();


  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? "");
  const [uidCopied, setUidCopied] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const lang = settings?.lang ?? "ru";
  const copy = getUiCopy(lang);

  const editorGroups = useMemo(
    () => [
      ["toolbarVisible", lang === "ru" ? "Тулбар" : "Toolbar"],
      ["bold", "Bold"],
      ["italic", "Italic"],
      ["underline", "Underline"],
      ["strike", "Strike"],
      ["bullets", lang === "ru" ? "Маркеры" : "Bullets"],
      ["numbered", lang === "ru" ? "Нумерация" : "Numbered"],
      ["hr", "Divider"],
      ["alignText", lang === "ru" ? "Выравнивание текста" : "Text align"],
      ["alignMedia", lang === "ru" ? "Выравнивание медиа" : "Media align"],
      ["clearFormat", lang === "ru" ? "Очистка форматирования" : "Clear format"],
      ["undoRedo", lang === "ru" ? "Undo / redo" : "Undo / redo"],
      ["links", lang === "ru" ? "Ссылки" : "Links"],
      ["pages", lang === "ru" ? "Страницы" : "Pages"],
      ["inlineTags", lang === "ru" ? "Inline tags" : "Inline tags"],
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

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:p-6 pb-24">
      <div className="mx-auto grid max-w-7xl min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] pb-12">
        <aside className="app-surface rounded-[1.6rem] min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:sticky lg:top-6 lg:self-start">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            {copy.common.back}
          </Link>

          <h1 className="mt-5 text-2xl lg:text-3xl font-black tracking-tight">{copy.settings.title}</h1>
          <p className="mt-2 text-xs leading-5 text-foreground/58 sm:text-sm sm:leading-6">{copy.settings.description}</p>

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

          <div className="mt-4 w-full min-w-0 rounded-[1.4rem] border border-border bg-surface-strong p-3 text-xs text-foreground/62 sm:mt-6 sm:p-4 sm:text-sm">
            <p className="font-black text-foreground">{copy.settings.appearance.pendingSync}</p>
            <p className="mt-2">{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") : copy.settings.appearance.noPendingSync}</p>
          </div>
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
                    UI opacity: {settings.uiOpacity.toFixed(2)}
                    <input className="mt-2 w-full min-w-0" max="1" min="0.4" onChange={(event) => void patchSettings({ uiOpacity: Number(event.target.value) })} step="0.02" type="range" value={settings.uiOpacity} />
                  </label>
                  <label className="flex w-full min-w-0 flex-col overflow-hidden text-sm font-bold text-foreground/72">
                    Cards opacity: {settings.cardsOpacity.toFixed(2)}
                    <input className="mt-2 w-full min-w-0" max="1" min="0.4" onChange={(event) => void patchSettings({ cardsOpacity: Number(event.target.value) })} step="0.02" type="range" value={settings.cardsOpacity} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block w-full min-w-0 truncate text-sm font-bold text-foreground/72">
                    {copy.settings.appearance.mainBackgroundUrl}
                    <input className="mt-2 w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm" onChange={(event) => void patchSettings({ mainBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.mainBackgroundUrl ?? ""} />
                    <button className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("mainBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                  </label>
                  <label className="block w-full min-w-0 truncate text-sm font-bold text-foreground/72">
                    {copy.settings.appearance.sidebarBackgroundUrl}
                    <input className="mt-2 w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm" onChange={(event) => void patchSettings({ sidebarBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.sidebarBackgroundUrl ?? ""} />
                    <button className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("sidebarBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                  </label>
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
                  {(["compact", "full"] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm ${settings.folderViewMode === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ folderViewMode: item })} type="button">
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([5, 10, 20, 50] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm ${settings.notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ notesPerPage: item })} type="button">
                      {item} / page
                    </button>
                  ))}
                </div>
                <button className={`mt-4 min-h-11 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm ${settings.reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} onClick={() => void patchSettings({ reduceMotion: !settings.reduceMotion })} type="button">
                  {settings.reduceMotion ? `${copy.common.on}` : `${copy.common.off}`}
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
                    ["showSavedFilters", "Saved filters"],
                    ["showTagFilter", "Tag filter"],
                    ["showUpdatedPeriodFilter", "Updated period filter"],
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
                 <div className="mt-4 rounded-[1.2rem] border border-border bg-surface-strong p-4 text-sm text-foreground/58">
                   <p className="font-black text-foreground">{copy.settings.data.preset}: {settings.preset}</p>
                   <p>{copy.settings.data.background}: {settings.mainBackgroundUrl ? copy.common.custom : copy.common.default}</p>
                   <p>{copy.settings.data.customPresets}: {settings.customPresets.length}</p>
                 </div>
               </Panel>

               <Panel title={lang === "ru" ? "Хранилище Google Drive (BYOS)" : "Google Drive Storage (BYOS)"}>
                 <div className="rounded-[1.2rem] border border-border bg-surface-strong p-4 text-sm text-foreground/58 space-y-3">
                   <p className="font-black text-foreground">
                     {lang === "ru" ? "Статус: " : "Status: "}
                     {(user as any)?.app_metadata?.provider === "google" || (user as any)?.identities?.some((i: any) => i.provider === "google") ? (
                       <span className="text-emerald-500">{lang === "ru" ? "Подключено (Вход через Google)" : "Connected (Signed in via Google)"}</span>
                     ) : (
                       <span className="text-amber-500">
                         {lang === "ru" 
                           ? "Локальный режим (Файлы сохраняются в заметках)" 
                           : "Local-only mode (Files are stored inside notes)"}
                       </span>
                     )}
                   </p>
                   <p className="text-xs leading-5">
                     {lang === "ru" 
                       ? "Концепция BYOS (Bring Your Own Storage) позволяет загружать все изображения напрямую в ваш личный Google Drive. Приложение сохраняет только ссылки на файлы. Для включения этой функции войдите в систему с помощью учетной записи Google."
                       : "The BYOS (Bring Your Own Storage) concept allows you to upload all images directly to your personal Google Drive. The app only stores file metadata. To enable this feature, sign in with your Google account."}
                   </p>
                 </div>
               </Panel>
             </div>
           ) : null}

          {activeSection === "profile" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.profile.title} text={copy.settings.profile.subtitle} />

              {/* Account info */}
              <Panel title={copy.settings.profile.accountInfo}>
                <div className="space-y-3">
                  {/* Email */}
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-foreground/60">{copy.settings.profile.email}</p>
                    <div className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground/70 flex items-center">
                      {user?.email ?? "—"}
                    </div>
                  </div>

                  {/* UID */}
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-foreground/60">{copy.settings.profile.uid}</p>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs text-foreground/60 min-h-11 flex items-center">
                        {user?.id ?? "—"}
                      </div>
                      <button
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${uidCopied ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground/60 hover:bg-surface-strong"}`}
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
                    {uidCopied ? <p className="mt-1 text-xs text-accent">{copy.settings.profile.copied}</p> : null}
                  </div>
                </div>
              </Panel>

              {/* Display name + Avatar */}
              <Panel title={copy.settings.profile.displayName}>
                <div className="space-y-4">
                  {/* Avatar preview */}
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.2rem] border border-border bg-surface-strong text-lg font-black text-foreground/40">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
                      ) : (
                        <span>{(displayName || user?.email || "?").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold hover:bg-surface-strong transition"
                        onClick={() => void uploadAvatar()}
                        type="button"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {copy.settings.profile.uploadAvatar}
                      </button>
                      {avatarUrl ? (
                        <button
                          className="text-left text-xs font-bold text-rose-500 hover:underline min-h-9 flex items-center"
                          onClick={() => setAvatarUrl("")}
                          type="button"
                        >
                          Удалить аватар
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Avatar URL input */}
                  <label className="block text-xs font-bold text-foreground/60">
                    {copy.settings.profile.avatarUrl}
                    <input
                      className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm min-h-11"
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder={copy.settings.profile.avatarUrlPlaceholder}
                      type="url"
                      value={avatarUrl}
                    />
                  </label>

                  {/* Display name input + Save */}
                  <label className="block text-xs font-bold text-foreground/60">
                    {copy.settings.profile.displayName}
                    <div className="mt-1.5 flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm min-h-11"
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={copy.settings.profile.displayNamePlaceholder}
                        type="text"
                        value={displayName}
                      />
                      <button
                        className={`shrink-0 min-h-11 rounded-2xl px-4 text-sm font-bold transition ${profileSaved ? "bg-accent/10 text-accent" : "bg-accent text-accent-foreground"}`}
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
                  </label>
                </div>
              </Panel>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
