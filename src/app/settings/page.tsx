"use client";

import {
  ArrowLeft,
  Database,
  Download,
  FileJson,
  Palette,
  Plus,
  RotateCcw,
  Upload,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { CustomThemePreset, EditorToolKey } from "@/entities/settings";
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
] as const;

const themePresets = ["paper", "smarthub", "smartlib", "cyber", "lego", "classic"] as const;

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const [presetName, setPresetName] = useState("");
  const { data: settings, isLoading, error } = useSettingsQuery();
  const { data: folders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const userId = useAuthStore((state) => state.user?.id ?? "local-user");
  const { createNote } = useNoteActions();
  const { patchSettings, resetSettings } = useSettingsActions();

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-4 sm:px-6 lg:p-6">
        <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-border bg-surface p-6 text-sm text-foreground/64 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
          Загрузка настроек...
        </div>
      </main>
    );
  }

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

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:p-6">
      <div className="mx-auto grid max-w-7xl min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="app-surface min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:sticky lg:top-6 lg:self-start">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            {copy.common.back}
          </Link>

          <h1 className="mt-5 text-2xl lg:text-3xl font-black tracking-tight">{copy.settings.title}</h1>
          <p className="mt-2 text-xs leading-5 text-foreground/58 sm:text-sm sm:leading-6">{copy.settings.description}</p>

          <nav className="mt-6 flex w-full max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {sections.map((section) => {
              const Icon = section.icon;
              const label = copy.settings.sections[section.id];

              return (
                <button
                  className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-left whitespace-nowrap transition lg:w-full sm:min-w-[10rem] sm:p-3 ${activeSection === section.id ? "bg-foreground text-background" : "hover:bg-surface-strong"}`}
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

          <div className="mt-4 w-full min-w-0 rounded-xl border border-border bg-surface-strong p-3 text-xs text-foreground/62 sm:mt-6 sm:rounded-[1.4rem] sm:p-4 sm:text-sm">
            <p className="font-black text-foreground">{copy.settings.appearance.pendingSync}</p>
            <p className="mt-2">{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") : copy.settings.appearance.noPendingSync}</p>
          </div>
        </aside>

        <section className="app-surface min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7">
          {activeSection === "appearance" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.appearance.title} text={copy.settings.appearance.subtitle} />
              <Panel title={copy.settings.appearance.themePresets}>
                <div className="flex flex-wrap gap-2">
                  {themePresets.map((item) => (
                    <button className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-black sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${settings.preset === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ preset: item })} type="button">
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
                    <input className="mt-2 w-full min-w-0 rounded-2xl border border-border bg-background px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm" onChange={(event) => void patchSettings({ mainBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.mainBackgroundUrl ?? ""} />
                    <button className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold" onClick={() => void uploadBackground("mainBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                  </label>
                  <label className="block w-full min-w-0 truncate text-sm font-bold text-foreground/72">
                    {copy.settings.appearance.sidebarBackgroundUrl}
                    <input className="mt-2 w-full min-w-0 rounded-2xl border border-border bg-background px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm" onChange={(event) => void patchSettings({ sidebarBackgroundUrl: event.target.value || null })} placeholder="https://..." type="url" value={settings.sidebarBackgroundUrl ?? ""} />
                    <button className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold" onClick={() => void uploadBackground("sidebarBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />Файл</button>
                  </label>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.localeAndLayout}>
                <div className="flex flex-wrap gap-2">
                  {(["ru", "en"] as const).map((item) => (
                    <button className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-black sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${settings.lang === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ lang: item })} type="button">
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["compact", "full"] as const).map((item) => (
                    <button className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-black sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${settings.folderViewMode === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ folderViewMode: item })} type="button">
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([5, 10, 20, 50] as const).map((item) => (
                    <button className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-black sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${settings.notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => void patchSettings({ notesPerPage: item })} type="button">
                      {item} / page
                    </button>
                  ))}
                </div>
                <button className={`mt-4 min-h-9 rounded-2xl border px-3 py-1.5 text-left text-xs font-bold sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${settings.reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} onClick={() => void patchSettings({ reduceMotion: !settings.reduceMotion })} type="button">
                  {settings.reduceMotion ? `${copy.common.on}` : `${copy.common.off}`}
                </button>
              </Panel>

              <Panel title={copy.settings.appearance.customPresets}>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <input className="w-full min-w-0 rounded-2xl border border-border bg-background px-3 py-2 text-xs sm:min-w-[16rem] sm:flex-1 sm:px-4 sm:py-3 sm:text-sm" onChange={(event) => setPresetName(event.target.value)} placeholder={copy.settings.appearance.customPresets} value={presetName} />
                  <button className="w-full min-h-9 rounded-2xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground sm:min-h-11 sm:w-auto sm:px-3 sm:py-2 sm:text-sm" onClick={() => { saveCurrentThemePreset(presetName); setPresetName(""); }} type="button">
                    {copy.settings.appearance.savePreset}
                  </button>
                  <button className="w-full min-h-9 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-bold sm:min-h-11 sm:w-auto sm:px-3 sm:py-2 sm:text-sm" onClick={() => void resetSettings()} type="button">
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
                          <button className="rounded-full bg-background p-2 text-foreground/60" onClick={() => removeCustomPreset(item.id)} type="button">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                        <button className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm" onClick={() => applyCustomPreset(item.id)} type="button">
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
                    <button className={`flex w-full min-w-0 items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs font-bold sm:px-3 sm:py-2 sm:text-sm ${settings.editor[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleEditorTool(key)} type="button">
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
                    <button className={`flex w-full min-w-0 items-center justify-between rounded-2xl border px-3 py-2 text-xs font-bold sm:px-3 sm:py-2 sm:text-sm ${settings.interface[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleInterfaceSection(key)} type="button">
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
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold sm:text-sm" onClick={() => void handleImportNotes()} type="button">
                    <Upload className="h-4 w-4" />
                    {copy.settings.data.importJson}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold sm:text-sm" onClick={exportAllNotes} type="button">
                    <Download className="h-4 w-4" />
                    {copy.settings.data.exportAll}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold sm:text-sm" onClick={exportFolderNotes} type="button">
                    <FileJson className="h-4 w-4" />
                    {copy.settings.data.exportFolder}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold sm:text-sm" onClick={() => window.location.reload()} type="button">
                    {copy.settings.data.resetCache}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl bg-accent px-3 py-2 text-xs font-bold text-accent-foreground sm:text-sm" onClick={() => void resetSettings()} type="button">
                    {copy.settings.data.resetSettings}
                  </button>
                </div>
                <div className="mt-4 rounded-[1.2rem] border border-border bg-surface-strong p-4 text-sm text-foreground/58">
                  <p className="font-black text-foreground">{copy.settings.data.preset}: {settings.preset}</p>
                  <p>{copy.settings.data.background}: {settings.mainBackgroundUrl ? copy.common.custom : copy.common.default}</p>
                  <p>{copy.settings.data.customPresets}: {settings.customPresets.length}</p>
                </div>
              </Panel>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
