"use client";

import {
  ArrowLeft,
  Database,
  FileText,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { getUiCopy } from "@/shared/lib/i18n";
import { useThemeStore } from "@/shared/store/theme-store";

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

  const lang = useThemeStore((state) => state.lang);
  const copy = getUiCopy(lang);
  const preset = useThemeStore((state) => state.preset);
  const folderViewMode = useThemeStore((state) => state.folderViewMode);
  const notesPerPage = useThemeStore((state) => state.notesPerPage);
  const reduceMotion = useThemeStore((state) => state.reduceMotion);
  const uiOpacity = useThemeStore((state) => state.uiOpacity);
  const cardsOpacity = useThemeStore((state) => state.cardsOpacity);
  const mainBackgroundUrl = useThemeStore((state) => state.mainBackgroundUrl);
  const sidebarBackgroundUrl = useThemeStore((state) => state.sidebarBackgroundUrl);
  const customPresets = useThemeStore((state) => state.customPresets);
  const editor = useThemeStore((state) => state.editor);
  const interfaceSettings = useThemeStore((state) => state.interface);
  const pendingSyncAt = useThemeStore((state) => state.pendingSyncAt);
  const setLang = useThemeStore((state) => state.setLang);
  const setPreset = useThemeStore((state) => state.setPreset);
  const setFolderViewMode = useThemeStore((state) => state.setFolderViewMode);
  const setNotesPerPage = useThemeStore((state) => state.setNotesPerPage);
  const setReduceMotion = useThemeStore((state) => state.setReduceMotion);
  const setUiOpacity = useThemeStore((state) => state.setUiOpacity);
  const setCardsOpacity = useThemeStore((state) => state.setCardsOpacity);
  const setMainBackgroundUrl = useThemeStore((state) => state.setMainBackgroundUrl);
  const setSidebarBackgroundUrl = useThemeStore((state) => state.setSidebarBackgroundUrl);
  const toggleInterfaceSection = useThemeStore((state) => state.toggleInterfaceSection);
  const toggleEditorTool = useThemeStore((state) => state.toggleEditorTool);
  const saveCurrentThemePreset = useThemeStore((state) => state.saveCurrentThemePreset);
  const applyCustomPreset = useThemeStore((state) => state.applyCustomPreset);
  const removeCustomPreset = useThemeStore((state) => state.removeCustomPreset);
  const resetThemeCache = useThemeStore((state) => state.resetThemeCache);
  const resetThemeSettings = useThemeStore((state) => state.resetThemeSettings);

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

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="app-surface border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:sticky lg:top-6 lg:self-start">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            {copy.common.back}
          </Link>

          <h1 className="mt-5 text-3xl font-black tracking-tight">{copy.settings.title}</h1>
          <p className="mt-2 text-sm leading-6 text-foreground/58">{copy.settings.description}</p>

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {sections.map((section) => {
              const Icon = section.icon;
              const label = copy.settings.sections[section.id];

              return (
                <button
                  className={`flex min-w-[10rem] items-center gap-3 rounded-2xl p-3 text-left transition lg:w-full ${activeSection === section.id ? "bg-foreground text-background" : "hover:bg-surface-strong"}`}
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  type="button"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-black">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[1.4rem] border border-border bg-surface-strong p-4 text-sm text-foreground/62">
            <p className="font-black text-foreground">{copy.settings.appearance.pendingSync}</p>
            <p className="mt-2">{pendingSyncAt ? new Date(pendingSyncAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") : copy.settings.appearance.noPendingSync}</p>
          </div>
        </aside>

        <section className="app-surface border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7">
          {activeSection === "appearance" ? (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.appearance.title} text={copy.settings.appearance.subtitle} />
              <Panel title={copy.settings.appearance.themePresets}>
                <div className="flex flex-wrap gap-2">
                  {themePresets.map((item) => (
                    <button className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black ${preset === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => setPreset(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-foreground/72">
                    UI opacity: {uiOpacity.toFixed(2)}
                    <input className="mt-2 w-full" max="1" min="0.4" onChange={(event) => setUiOpacity(Number(event.target.value))} step="0.02" type="range" value={uiOpacity} />
                  </label>
                  <label className="block text-sm font-bold text-foreground/72">
                    Cards opacity: {cardsOpacity.toFixed(2)}
                    <input className="mt-2 w-full" max="1" min="0.4" onChange={(event) => setCardsOpacity(Number(event.target.value))} step="0.02" type="range" value={cardsOpacity} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-foreground/72">
                    {copy.settings.appearance.mainBackgroundUrl}
                    <input className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:text-sm" onChange={(event) => setMainBackgroundUrl(event.target.value || null)} placeholder="https://..." type="url" value={mainBackgroundUrl ?? ""} />
                  </label>
                  <label className="block text-sm font-bold text-foreground/72">
                    {copy.settings.appearance.sidebarBackgroundUrl}
                    <input className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:text-sm" onChange={(event) => setSidebarBackgroundUrl(event.target.value || null)} placeholder="https://..." type="url" value={sidebarBackgroundUrl ?? ""} />
                  </label>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.localeAndLayout}>
                <div className="flex flex-wrap gap-2">
                  {(["ru", "en"] as const).map((item) => (
                    <button className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black ${lang === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => setLang(item)} type="button">
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["compact", "full"] as const).map((item) => (
                    <button className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black ${folderViewMode === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => setFolderViewMode(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([5, 10, 20, 50] as const).map((item) => (
                    <button className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black ${notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={item} onClick={() => setNotesPerPage(item)} type="button">
                      {item} / page
                    </button>
                  ))}
                </div>
                <button className={`mt-4 min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold ${reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} onClick={() => setReduceMotion(!reduceMotion)} type="button">
                  {reduceMotion ? `${copy.common.on}` : `${copy.common.off}`}
                </button>
              </Panel>

              <Panel title={copy.settings.appearance.customPresets}>
                <div className="flex flex-wrap gap-2">
                  <input className="min-w-[16rem] flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm" onChange={(event) => setPresetName(event.target.value)} placeholder={copy.settings.appearance.customPresets} value={presetName} />
                  <button className="rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground" onClick={() => { saveCurrentThemePreset(presetName); setPresetName(""); }} type="button">
                    {copy.settings.appearance.savePreset}
                  </button>
                  <button className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold" onClick={() => resetThemeSettings()} type="button">
                    {copy.settings.appearance.resetAppearance}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {customPresets.length ? (
                    customPresets.map((item) => (
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
                        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground" onClick={() => applyCustomPreset(item.id)} type="button">
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
                    <button className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold ${editor[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleEditorTool(key)} type="button">
                      <span>{label}</span>
                      <span>{editor[key] ? copy.settings.editor.on : copy.settings.editor.off}</span>
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
                    <button className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${interfaceSettings[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleInterfaceSection(key)} type="button">
                      <span>{label}</span>
                      <span>{interfaceSettings[key] ? copy.common.on : copy.common.off}</span>
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
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold" onClick={() => resetThemeCache()} type="button">
                    {copy.settings.data.resetCache}
                  </button>
                  <button className="rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground" onClick={() => resetThemeSettings()} type="button">
                    {copy.settings.data.resetSettings}
                  </button>
                </div>
                <div className="mt-4 rounded-[1.2rem] border border-border bg-surface-strong p-4 text-sm text-foreground/58">
                  <p className="font-black text-foreground">{copy.settings.data.preset}: {preset}</p>
                  <p>{copy.settings.data.background}: {mainBackgroundUrl ? copy.common.custom : copy.common.default}</p>
                  <p>{copy.settings.data.customPresets}: {customPresets.length}</p>
                </div>
              </Panel>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <Sparkles className="mt-1 h-5 w-5 text-accent" />
      <div>
        <h2 className="text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl leading-7 text-foreground/62">{text}</p>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.4rem] border border-border bg-surface-strong p-4 text-left">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}
