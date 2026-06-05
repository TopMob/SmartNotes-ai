"use client";

import {
  ArrowLeft,
  Check,
  Database,
  Download,
  FileJson,
  Palette,
  Plus,
  Upload,
  SlidersHorizontal,
  Type,
  UserRound,
  RefreshCw,
  Trash2,
  Save,
  X,
  Loader2,
  Edit2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

import type { CustomThemePreset, EditorToolKey, UserSettings } from "@/entities/settings";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { parseImportedNotesFile } from "@/features/notes/lib/note-import";
import { useSettingsActions } from "@/features/settings/hooks/use-settings-mutations";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { publish, subscribe } from "@/services/event-bus";
import { downloadTextFile, safeFileName } from "@/features/app-shell/ui/components/shared";
import { getUiCopy } from "@/shared/lib/i18n";
import { useUiStore } from "@/shared/store/ui-store";
import { isAdminUser } from "@/features/auth/lib/admin-acl";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";
import { listSyncQueue, clearSyncQueue, removeSyncItem, type SyncQueueItem } from "@/services/sync/sync-queue";
import { processSyncQueue } from "@/services/sync/sync-consumer";

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
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState("");
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
  const { updateProfile, pending: profilePending, connectGoogleDrive, logout } = useAuthActions();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? "");
  const [uidCopied, setUidCopied] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [compression, setCompression] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("smartnotes:media-compression") || "medium";
    }
    return "medium";
  });

  function handleSetCompression(level: string) {
    setCompression(level);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("smartnotes:media-compression", level);
    }
  }

  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  useEffect(() => {
    setSyncQueue(listSyncQueue());
    const unsubQueued = subscribe("syncQueued", () => setSyncQueue(listSyncQueue()));
    const unsubCompleted = subscribe("syncCompleted", () => setSyncQueue(listSyncQueue()));
    const unsubFailed = subscribe("syncFailed", () => setSyncQueue(listSyncQueue()));
    return () => {
      unsubQueued();
      unsubCompleted();
      unsubFailed();
    };
  }, []);

  // --- DRAFT STATE LOGIC ---
  const [draftSettings, setDraftSettings] = useState<UserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings && !draftSettings) {
      setDraftSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings, draftSettings]);

  // --- INSTANT PREVIEW EFFECT ---
  useEffect(() => {
    if (!draftSettings) return;
    const root = document.documentElement;
    root.lang = draftSettings.lang;
    root.dataset.theme = draftSettings.preset;
    root.style.setProperty("--ui-opacity", `${draftSettings.uiOpacity}`);
    root.style.setProperty("--cards-opacity", `${draftSettings.cardsOpacity}`);
    root.style.setProperty("--main-background-url", draftSettings.mainBackgroundUrl ? `url(${draftSettings.mainBackgroundUrl})` : "none");
    root.style.setProperty("--sidebar-background-url", draftSettings.sidebarBackgroundUrl ? `url(${draftSettings.sidebarBackgroundUrl})` : "none");

    return () => {
      // Revert to db settings on cleanup/unmount
      if (settings) {
        root.lang = settings.lang;
        root.dataset.theme = settings.preset;
        root.style.setProperty("--ui-opacity", `${settings.uiOpacity}`);
        root.style.setProperty("--cards-opacity", `${settings.cardsOpacity}`);
        root.style.setProperty("--main-background-url", settings.mainBackgroundUrl ? `url(${settings.mainBackgroundUrl})` : "none");
        root.style.setProperty("--sidebar-background-url", settings.sidebarBackgroundUrl ? `url(${settings.sidebarBackgroundUrl})` : "none");
      }
    };
  }, [draftSettings, settings]);

  const isDirty = useMemo(() => {
    if (!settings || !draftSettings) return false;
    const a = { ...settings, updatedAt: undefined };
    const b = { ...draftSettings, updatedAt: undefined };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [settings, draftSettings]);

  function handleUpdateDraft(updater: (prev: UserSettings) => UserSettings) {
    setDraftSettings((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  }

  async function handleSaveChanges() {
    if (!draftSettings) return;
    setIsSaving(true);
    try {
      await patchSettings(draftSettings);
      setDraftSettings(JSON.parse(JSON.stringify(draftSettings)));
    } catch {
      window.alert(lang === "ru" ? "Ошибка сохранения настроек" : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscardChanges() {
    if (settings) {
      setDraftSettings(JSON.parse(JSON.stringify(settings)));
    }
  }

  // --- SETTINGS MUTATORS ---
  function toggleInterfaceSection(key: keyof UserSettings["interface"]) {
    handleUpdateDraft((prev) => ({
      ...prev,
      interface: {
        ...prev.interface,
        [key]: !prev.interface[key],
      },
    }));
  }

  function toggleEditorTool(key: EditorToolKey) {
    handleUpdateDraft((prev) => ({
      ...prev,
      editor: {
        ...prev.editor,
        [key]: !prev.editor[key],
      },
    }));
  }

  function applyBuiltInPreset(presetName: string) {
    handleUpdateDraft((prev) => ({
      ...prev,
      preset: presetName as any,
    }));
  }

  function saveCurrentThemePreset(name: string) {
    if (!draftSettings) return;
    const baseName = name.trim() || `${lang === "ru" ? "Мой пресет" : "My Preset"} ${new Date().toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}`;
    
    let finalName = baseName;
    let suffix = 1;
    while (draftSettings.customPresets.some((item) => item.name === finalName)) {
      suffix++;
      finalName = `${baseName} (${suffix})`;
    }

    const nextPreset: CustomThemePreset = {
      id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: finalName,
      preset: draftSettings.preset,
      mainBackgroundUrl: draftSettings.mainBackgroundUrl,
      sidebarBackgroundUrl: draftSettings.sidebarBackgroundUrl,
      uiOpacity: draftSettings.uiOpacity,
      cardsOpacity: draftSettings.cardsOpacity,
    };
    handleUpdateDraft((prev) => ({
      ...prev,
      customPresets: [...prev.customPresets.filter((item) => item.id !== nextPreset.id).slice(-9), nextPreset],
    }));
    setPresetName("");
  }

  function renameCustomPreset(id: string, newName: string) {
    const finalName = newName.trim();
    if (!finalName) return;
    handleUpdateDraft((prev) => ({
      ...prev,
      customPresets: prev.customPresets.map((item) =>
        item.id === id ? { ...item, name: finalName } : item
      ),
    }));
    setEditingPresetId(null);
  }

  function applyCustomPreset(id: string) {
    if (!draftSettings) return;
    const preset = draftSettings.customPresets.find((item) => item.id === id);
    if (!preset) return;
    handleUpdateDraft((prev) => ({
      ...prev,
      preset: preset.preset,
      mainBackgroundUrl: preset.mainBackgroundUrl,
      sidebarBackgroundUrl: preset.sidebarBackgroundUrl,
      uiOpacity: preset.uiOpacity,
      cardsOpacity: preset.cardsOpacity,
    }));
  }

  function removeCustomPreset(id: string) {
    handleUpdateDraft((prev) => ({
      ...prev,
      customPresets: prev.customPresets.filter((item) => item.id !== id),
    }));
  }

  async function uploadBackground(target: "mainBackgroundUrl" | "sidebarBackgroundUrl") {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
        const supabase = createSupabaseBrowserClient();
        if (!supabase) throw new Error("No supabase client");

        const fileExt = file.name.split(".").pop() || "jpg";
        const randomName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${userId}/settings/${randomName}`;

        const { error } = await supabase.storage.from("note-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from("note-images").getPublicUrl(filePath);
        handleUpdateDraft((prev) => ({ ...prev, [target]: publicUrl }));
      } catch {
        window.alert(lang === "ru" ? "Не удалось загрузить фон." : "Failed to upload background.");
      }
    };
    picker.click();
  }

  const lang = draftSettings?.lang ?? settings?.lang ?? "ru";
  const copy = getUiCopy(lang);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError(lang === "ru" ? "Введите текущий пароль" : "Enter current password");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(lang === "ru" ? "Новый пароль должен быть не менее 6 символов" : "New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(lang === "ru" ? "Пароли не совпадают" : "Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase client not initialized");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) throw new Error(lang === "ru" ? "Неверный текущий пароль" : "Incorrect current password");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      window.alert(lang === "ru" ? "Пароль успешно изменен!" : "Password changed successfully!");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPasswordError(e.message || "Ошибка при смене пароля");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleImportNotes() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const importedNotes = parseImportedNotesFile(text, userId);
        for (const importedNote of importedNotes) {
          await createNote({ title: importedNote.title, content: importedNote.content, folderId: importedNote.folderId, userTags: importedNote.userTags }, userId, importedNote);
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
    downloadTextFile(`smartnotes-all-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: exportable }, null, 2), "application/json;charset=utf-8");
  }

  function exportFolderNotes() {
    const visibleFolders = folders.filter((folder) => !folder.trashedAt);
    const folderName = window.prompt(visibleFolders.length ? `Название папки для экспорта:\n${visibleFolders.map((folder) => `• ${folder.name}`).join("\n")}` : "Пока нет папок для экспорта.")?.trim();
    if (!folderName) return;
    const folder = visibleFolders.find((item) => item.name.toLocaleLowerCase() === folderName.toLocaleLowerCase());
    if (!folder) {
      window.alert("Папка не найдена. Введите название папки из списка.");
      return;
    }
    const folderId = folder.id;
    const exportable = notes.filter((note) => note.folderId === folderId && !note.lock?.hidden);
    downloadTextFile(`${safeFileName(`smartnotes-folder-${folder.name}`)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), folderId, folderName: folder.name, notes: exportable }, null, 2), "application/json;charset=utf-8");
  }

  function copyUid() {
    const uid = user?.id ?? "";
    void navigator.clipboard.writeText(uid).then(() => {
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    });
  }

  async function handleSaveProfile() {
    await updateProfile({ displayName: displayName.trim() || undefined, photoURL: avatarUrl.trim() || null });
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
      try {
        const { createSupabaseBrowserClient } = await import("@/shared/api/supabase/client");
        const supabase = createSupabaseBrowserClient();
        if (!supabase) throw new Error("No supabase client");
        const fileExt = file.name.split(".").pop() || "jpg";
        const randomName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${userId}/avatar/${randomName}`;
        const { error } = await supabase.storage.from("note-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("note-images").getPublicUrl(filePath);
        setAvatarUrl(publicUrl);
      } catch {
        window.alert(lang === "ru" ? "Не удалось загрузить аватар." : "Failed to upload avatar.");
      }
    };
    picker.click();
  }

  async function handleDisconnectDrive() {
    if (!window.confirm(lang === "ru" ? "Вы уверены, что хотите отключить Google Диск?" : "Are you sure you want to disconnect Google Drive?")) return;
    try {
      const response = await fetch("/api/media/google-drive/disconnect", { method: "POST" });
      if (response.ok) {
        setDriveConnected(false);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch {
      window.alert(lang === "ru" ? "Не удалось отключить Диск." : "Failed to disconnect Drive.");
    }
  }

  const editorGroups = useMemo(() => [
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
  ] as const, [lang]);

  if (!settings || !draftSettings) {
    return (
      <main className="min-h-screen px-4 py-4 sm:px-6 lg:p-6">
        <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-border bg-surface p-6 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
          <h1 className="text-xl font-black">{copy?.settings?.title || "Настройки"}</h1>
          <p className="mt-2 text-sm text-foreground/64">
            {error instanceof Error ? error.message : "Загрузка настроек..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:p-6 pb-24 relative">
      
      {/* --- DRAFT SAVE BAR --- */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full border border-border bg-surface/95 px-4 py-3 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-300 z-[100]">
          <div className="flex flex-col pr-4 border-r border-border">
            <span className="text-xs font-black text-foreground">{lang === "ru" ? "Несохраненные изменения" : "Unsaved changes"}</span>
            <span className="text-[10px] font-medium text-foreground/50">{lang === "ru" ? "Нажмите сохранить, чтобы применить" : "Click save to apply"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDiscardChanges} 
              disabled={isSaving}
              className="flex h-9 items-center justify-center rounded-full px-4 text-xs font-bold text-foreground/70 transition hover:bg-surface-strong hover:text-foreground disabled:opacity-50"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              {lang === "ru" ? "Отмена" : "Discard"}
            </button>
            <button 
              onClick={() => void handleSaveChanges()} 
              disabled={isSaving}
              className="flex h-9 items-center justify-center rounded-full bg-accent px-5 text-xs font-bold text-accent-foreground shadow-lg transition hover:bg-accent/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {lang === "ru" ? "Сохранить" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] pb-12">
        <aside className="app-surface rounded-[1.6rem] min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:sticky lg:top-6 lg:self-start z-10">
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
                  className={`shrink-0 flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-left whitespace-nowrap transition lg:w-full sm:min-w-[10rem] sm:p-3 ${activeSection === section.id ? "bg-foreground text-background shadow-md" : "hover:bg-surface-strong"}`}
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

        <section className="app-surface rounded-[1.6rem] min-w-0 border border-border p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7 z-10">
          {activeSection === "appearance" && (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.appearance.title} text={copy.settings.appearance.subtitle} />
              <Panel title={copy.settings.appearance.themePresets}>
                <div className="flex flex-wrap gap-2">
                  {themePresets.map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.preset === item ? "border-accent bg-accent/10 text-accent ring-2 ring-accent/20" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => applyBuiltInPreset(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <label className="flex w-full min-w-0 flex-col overflow-hidden text-sm font-bold text-foreground/72">
                    {lang === "ru" ? `Прозрачность интерфейса: ${draftSettings.uiOpacity.toFixed(2)}` : `UI opacity: ${draftSettings.uiOpacity.toFixed(2)}`}
                    <input className="mt-3 w-full min-w-0 accent-accent" max="1" min="0.4" onChange={(e) => handleUpdateDraft(p => ({ ...p, uiOpacity: Number(e.target.value) }))} step="0.02" type="range" value={draftSettings.uiOpacity} />
                  </label>
                  <label className="flex w-full min-w-0 flex-col overflow-hidden text-sm font-bold text-foreground/72">
                    {lang === "ru" ? `Прозрачность карточек: ${draftSettings.cardsOpacity.toFixed(2)}` : `Cards opacity: ${draftSettings.cardsOpacity.toFixed(2)}`}
                    <input className="mt-3 w-full min-w-0 accent-accent" max="1" min="0.4" onChange={(e) => handleUpdateDraft(p => ({ ...p, cardsOpacity: Number(e.target.value) }))} step="0.02" type="range" value={draftSettings.cardsOpacity} />
                  </label>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <span className="text-sm font-bold text-foreground/72">{copy.settings.appearance.mainBackgroundUrl}</span>
                    <div className="flex gap-2">
                      <input id="appearance_main_bg_url" name="appearance_main_bg_url" className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-normal focus:border-accent focus:ring-1 focus:ring-accent outline-none transition" onChange={(e) => handleUpdateDraft(p => ({ ...p, mainBackgroundUrl: e.target.value || null }))} placeholder="https://..." type="url" value={draftSettings.mainBackgroundUrl ?? ""} />
                      <button className="shrink-0 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("mainBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />{lang === "ru" ? "Файл" : "File"}</button>
                    </div>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <span className="text-sm font-bold text-foreground/72">{copy.settings.appearance.sidebarBackgroundUrl}</span>
                    <div className="flex gap-2">
                      <input id="appearance_sidebar_bg_url" name="appearance_sidebar_bg_url" className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-normal focus:border-accent focus:ring-1 focus:ring-accent outline-none transition" onChange={(e) => handleUpdateDraft(p => ({ ...p, sidebarBackgroundUrl: e.target.value || null }))} placeholder="https://..." type="url" value={draftSettings.sidebarBackgroundUrl ?? ""} />
                      <button className="shrink-0 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong" onClick={() => void uploadBackground("sidebarBackgroundUrl")} type="button"><Plus className="h-3.5 w-3.5" />{lang === "ru" ? "Файл" : "File"}</button>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.localeAndLayout}>
                <div className="flex flex-wrap gap-2">
                  {(["ru", "en"] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.lang === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => handleUpdateDraft(p => ({ ...p, lang: item }))} type="button">
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {([5, 10, 20, 50] as const).map((item) => (
                    <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => handleUpdateDraft(p => ({ ...p, notesPerPage: item }))} type="button">
                      {lang === "ru" ? `${item} на стр.` : `${item} / page`}
                    </button>
                  ))}
                </div>
                <button className={`mt-4 min-h-11 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm transition ${draftSettings.reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} onClick={() => handleUpdateDraft(p => ({ ...p, reduceMotion: !p.reduceMotion }))} type="button">
                  {lang === "ru" ? `Упрощенные анимации: ${draftSettings.reduceMotion ? "Вкл" : "Выкл"}` : `Reduce motion: ${draftSettings.reduceMotion ? "On" : "Off"}`}
                </button>
              </Panel>

              <Panel title={copy.settings.appearance.customPresets}>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <input id="appearance_preset_name" name="appearance_preset_name" className="w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm sm:min-w-[16rem] sm:flex-1 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition" onChange={(e) => setPresetName(e.target.value)} placeholder={copy.settings.appearance.customPresets} value={presetName} />
                  <button className="w-full min-h-11 rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground sm:w-auto transition hover:bg-accent/90 shadow-sm" onClick={() => saveCurrentThemePreset(presetName)} type="button">
                    {copy.settings.appearance.savePreset}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold sm:w-auto transition hover:bg-surface-strong" onClick={() => void resetSettings()} type="button">
                    {copy.settings.appearance.resetAppearance}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {draftSettings.customPresets.length ? (
                    draftSettings.customPresets.map((item) => (
                      <div className="rounded-[1.3rem] border border-border bg-surface-strong p-4 flex flex-col justify-between font-sans" key={item.id}>
                        {editingPresetId === item.id ? (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-1.5 w-full">
                              <input 
                                id="appearance_edit_preset_name"
                                name="appearance_edit_preset_name"
                                className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold focus:border-accent focus:ring-1 focus:ring-accent outline-none transition" 
                                value={editPresetName}
                                onChange={(e) => setEditPresetName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    renameCustomPreset(item.id, editPresetName);
                                  } else if (e.key === "Escape") {
                                    setEditingPresetId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <button className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition shadow-sm" onClick={() => renameCustomPreset(item.id, editPresetName)} type="button">
                                <Check className="h-4 w-4" />
                              </button>
                              <button className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-border bg-background text-foreground/60 hover:bg-surface-strong transition" onClick={() => setEditingPresetId(null)} type="button">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="text-xs text-foreground/52 truncate">Base: {item.preset}</p>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="overflow-hidden min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => {
                                setEditingPresetId(item.id);
                                setEditPresetName(item.name);
                              }}>
                                <p className="font-black truncate text-sm sm:text-base text-foreground">{item.name}</p>
                                <Edit2 className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition text-foreground shrink-0" />
                              </div>
                              <p className="mt-1 text-xs text-foreground/52 truncate">Base: {item.preset}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button 
                                className="rounded-full bg-background h-9 w-9 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-surface-strong transition border border-border" 
                                onClick={() => {
                                  setEditingPresetId(item.id);
                                  setEditPresetName(item.name);
                                }} 
                                type="button"
                                title={lang === "ru" ? "Переименовать" : "Rename"}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                className="rounded-full bg-background h-9 w-9 flex items-center justify-center text-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition border border-border" 
                                onClick={() => removeCustomPreset(item.id)} 
                                type="button"
                                title={lang === "ru" ? "Удалить" : "Delete"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                        <button className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 shadow-sm" onClick={() => applyCustomPreset(item.id)} type="button">
                          {copy.common.apply}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.3rem] border border-dashed border-border bg-surface-strong p-4 text-sm text-foreground/56 col-span-full text-center py-8">{copy.settings.appearance.noCustomPresets}</div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {activeSection === "editor" && (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.editor.title} text={copy.settings.editor.subtitle} />
              <Panel title={copy.settings.editor.tools}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {editorGroups.map(([key, label]) => (
                    <button className={`flex w-full min-w-0 min-h-11 items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm transition hover:bg-surface-strong ${draftSettings.editor[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleEditorTool(key)} type="button">
                      <span className="truncate pr-3">{label}</span>
                      <span>{draftSettings.editor[key] ? copy.settings.editor.on : copy.settings.editor.off}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {activeSection === "filters" && (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.filters.title} text={copy.settings.filters.subtitle} />
              <Panel title={copy.settings.filters.sections}>
                <div className="space-y-2">
                  {([
                    ["showSavedFilters", copy.settings.filters.savedFilters],
                    ["showTagFilter", copy.settings.filters.tagFilter],
                    ["showUpdatedPeriodFilter", copy.settings.filters.updatedPeriodFilter],
                  ] as const).map(([key, label]) => (
                    <button className={`flex w-full min-w-0 min-h-11 items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong ${draftSettings.interface[key] ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"}`} key={key} onClick={() => toggleInterfaceSection(key)} type="button">
                      <span className="truncate pr-3">{label}</span>
                      <span>{draftSettings.interface[key] ? copy.common.on : copy.common.off}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {activeSection === "data" && (
            <div className="space-y-4">
              <SectionIntro title={copy.settings.data.title} text={copy.settings.data.subtitle} />
              <Panel title={copy.settings.data.maintenance}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={() => void handleImportNotes()} type="button">
                    <Upload className="h-4 w-4" />
                    {copy.settings.data.importJson}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={exportAllNotes} type="button">
                    <Download className="h-4 w-4" />
                    {copy.settings.data.exportAll}
                  </button>
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={exportFolderNotes} type="button">
                    <FileJson className="h-4 w-4" />
                    {copy.settings.data.exportFolder}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={() => window.location.reload()} type="button">
                    {copy.settings.data.resetCache}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-rose-500/20 shadow-sm" onClick={() => void resetSettings()} type="button">
                    {copy.settings.data.resetSettings}
                  </button>
                </div>
              </Panel>

              <Panel title={lang === "ru" ? "Облачное хранилище медиафайлов" : "Cloud Media Storage"}>
                <div className="rounded-[1.2rem] border border-border bg-surface-strong p-5 text-sm text-foreground/58 space-y-6">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">
                      {lang === "ru" ? "Основное хранилище (Supabase Storage)" : "Default Storage (Supabase Storage)"}
                    </span>
                    <div className="mt-2 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {lang === "ru" ? "Активно и работает" : "Active and running"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                          {lang === "ru"
                            ? "Каждому пользователю предоставляется бесплатное защищённое хранилище объёмом до 1 ГБ. Все медиафайлы автоматически оптимизируются."
                            : "Each user gets up to 1 GB of secure storage free of charge. All media assets are automatically optimized."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">
                      {lang === "ru" ? "Дополнительно: Google Диск (BYOS)" : "Optional: Google Drive (BYOS)"}
                    </span>

                    <p className="mt-2 text-sm font-bold text-foreground">
                      {lang === "ru" ? "Статус интеграции: " : "Integration Status: "}
                      {gdriveDisabled ? (
                        <span className="text-amber-500">{lang === "ru" ? "Отключена пользователем" : "Disabled by user"}</span>
                      ) : driveConnected ? (
                        <span className="text-emerald-500">{lang === "ru" ? "Подключено (Оригиналы)" : "Connected (Original Quality)"}</span>
                      ) : (
                        <span className="text-foreground/48">{lang === "ru" ? "Не подключено" : "Not connected"}</span>
                      )}
                    </p>

                    <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">
                      {lang === "ru"
                        ? "Концепция BYOS (Bring Your Own Storage) позволяет загружать все изображения напрямую в ваш личный Google Drive."
                        : "The BYOS concept lets you upload photos directly to your personal Google Drive account."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {driveConnected && !gdriveDisabled && (
                        <button
                          onClick={() => void handleDisconnectDrive()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition text-xs font-bold px-4 py-2"
                          type="button"
                        >
                          {lang === "ru" ? "Отключить аккаунт" : "Disconnect Account"}
                        </button>
                      )}
                      
                      {!driveConnected && (
                        <button
                          onClick={() => void connectGoogleDrive()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition hover:bg-accent/90 shadow-sm"
                          type="button"
                        >
                          {lang === "ru" ? "Подключить Google Диск" : "Connect Google Drive"}
                        </button>
                      )}

                      <button
                        onClick={handleToggleGoogleDrive}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition shadow-sm ${
                          gdriveDisabled 
                            ? "border-accent bg-accent/10 text-accent" 
                            : "border-border bg-background hover:bg-surface-strong text-foreground/72"
                        }`}
                        type="button"
                      >
                        {gdriveDisabled 
                          ? (lang === "ru" ? "Включить интеграцию" : "Enable Integration")
                          : (lang === "ru" ? "Отключить интеграцию" : "Disable Integration")}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">
                      {lang === "ru" ? "Степень сжатия изображений" : "Image Compression Quality"}
                    </span>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        ["low", lang === "ru" ? "Низкое" : "Low"],
                        ["medium", lang === "ru" ? "Среднее" : "Medium"],
                        ["high", lang === "ru" ? "Высокое" : "High"],
                        ["original", lang === "ru" ? "Оригинал" : "Original"]
                      ] as const).map(([level, label]) => (
                        <button
                          key={level}
                          onClick={() => handleSetCompression(level)}
                          className={`flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition shadow-sm ${
                            compression === level 
                              ? "border-accent bg-accent text-accent-foreground ring-2 ring-accent/20" 
                              : "border-border bg-background hover:bg-surface-strong text-foreground/72"
                          }`}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-foreground/50">
                      {lang === "ru"
                        ? "Изменения применяются мгновенно и локально."
                        : "Changes apply instantly to this device."}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel title={lang === "ru" ? "Диагностика синхронизации" : "Sync Diagnostics"}>
                <div className="rounded-[1.2rem] border border-border bg-surface-strong p-5 text-sm text-foreground/58 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void processSyncQueue()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition hover:bg-accent/90 shadow-sm"
                      type="button"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {lang === "ru" ? "Синхронизировать сейчас" : "Sync Now"}
                    </button>
                    {syncQueue.length > 0 && (
                      <button
                        onClick={() => {
                          clearSyncQueue();
                          setSyncQueue([]);
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition text-xs font-bold px-4 py-2"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {lang === "ru" ? "Очистить очередь" : "Clear Queue"}
                      </button>
                    )}
                  </div>

                  <div className="pt-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42 mb-2">
                      {lang === "ru" ? "Очередь отложенной синхронизации" : "Pending Sync Queue"}
                    </span>
                    {syncQueue.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center">
                        <p className="text-xs font-medium text-foreground/48">
                          {lang === "ru" ? "Все данные синхронизированы с облаком." : "All local changes are fully synced."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {syncQueue.map((item) => (
                          <div key={item.id + item.operation} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background shadow-sm text-xs transition hover:border-foreground/20">
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground capitalize">{item.entity}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  item.operation === "create" ? "bg-emerald-500/15 text-emerald-500" :
                                  item.operation === "patch" ? "bg-amber-500/15 text-amber-500" :
                                  "bg-rose-500/15 text-rose-500"
                                }`}>
                                  {item.operation}
                                </span>
                              </div>
                              <div className="text-[10px] text-foreground/42 mt-1 truncate font-mono">
                                ID: {item.id} • {new Date(item.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US")}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                removeSyncItem(item.id);
                                setSyncQueue(listSyncQueue());
                              }}
                              className="p-2 text-foreground/42 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition shrink-0"
                              type="button"
                              title={lang === "ru" ? "Удалить" : "Delete"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {activeSection === "profile" && (
            <div className="space-y-6">
              <SectionIntro title={copy.settings.profile.title} text={copy.settings.profile.subtitle} />

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title={copy.settings.profile.profileDetails || "Данные профиля"}>
                  <div className="space-y-5">
                    <div className="flex flex-col items-center gap-5 p-5 rounded-[1.3rem] bg-surface-strong border border-border sm:flex-row">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface-strong text-3xl font-black text-foreground/45 shadow-lg">
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
                        {avatarUrl && (
                          <button
                            className="w-full text-center text-xs font-bold text-rose-500 hover:text-rose-600 transition min-h-10 flex items-center justify-center border border-rose-500/20 rounded-xl bg-rose-500/5 hover:bg-rose-500/10"
                            onClick={() => setAvatarUrl("")}
                            type="button"
                          >
                            {copy.settings.profile.deleteAvatar || "Удалить аватар"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="block mb-1.5 text-xs font-bold text-foreground/70">{copy.settings.profile.avatarUrl}</span>
                      <input
                        id="profile_avatar_url"
                        name="profile_avatar_url"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-normal"
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder={copy.settings.profile.avatarUrlPlaceholder}
                        type="url"
                        value={avatarUrl}
                      />
                    </div>

                    <div>
                      <span className="block mb-1.5 text-xs font-bold text-foreground/70">{copy.settings.profile.displayName}</span>
                      <input
                        id="profile_display_name"
                        name="profile_display_name"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-normal"
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={copy.settings.profile.displayNamePlaceholder}
                        type="text"
                        value={displayName}
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        className={`w-full min-h-11 rounded-xl px-4 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${profileSaved ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/25" : "bg-accent text-accent-foreground hover:bg-accent/90"}`}
                        disabled={profilePending}
                        onClick={() => void handleSaveProfile()}
                        type="button"
                      >
                        {profilePending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : profileSaved
                            ? <Check className="h-4 w-4" />
                            : null}
                        {profilePending
                          ? copy.settings.profile.saving
                          : profileSaved
                            ? copy.settings.profile.saved
                            : copy.settings.profile.saveProfile}
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title={copy.settings.profile.securityAndSession || "Безопасность и сессия"}>
                  <div className="space-y-5">
                    <div>
                      <span className="block mb-1.5 text-xs font-bold text-foreground/70">{copy.settings.profile.email}</span>
                      <input
                        className="w-full min-h-11 rounded-xl border border-border/80 bg-background/50 px-4 py-2 text-sm text-foreground/60 select-all cursor-default font-normal"
                        readOnly
                        value={user?.email ?? "-"}
                      />
                    </div>

                    <div>
                      <span className="block mb-1.5 text-xs font-bold text-foreground/70">{copy.settings.profile.uid}</span>
                      <div className="flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background/50 px-4 py-2 font-mono text-[11px] text-foreground/60 select-all cursor-default min-h-11"
                          readOnly
                          value={user?.id ?? "-"}
                        />
                        <button
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${uidCopied ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border/80 bg-background text-foreground/60 hover:bg-surface-strong"}`}
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

                    {user?.createdAt && (
                      <div className="grid grid-cols-2 gap-3 p-4 rounded-[1.3rem] bg-surface-strong border border-border text-xs text-foreground/60 font-medium">
                        <div>
                          <span className="block text-[10px] text-foreground/45 uppercase tracking-wider font-black">{copy.settings.profile.registeredAt || "Регистрация"}</span>
                          <span className="mt-1 block truncate text-foreground font-bold">
                            {new Date(user.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-foreground/45 uppercase tracking-wider font-black">{copy.settings.profile.lastLoginAt || "Последний вход"}</span>
                          <span className="mt-1 block truncate text-foreground font-bold">
                            {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-3">
                      {user?.email && user.id !== "local-user" && !user.id.startsWith("guest-") && (
                        <>
                          {!showChangePassword ? (
                            <button
                              className="w-full min-h-11 rounded-xl border border-border bg-background hover:bg-surface-strong transition flex items-center justify-center gap-2 text-sm font-bold text-foreground/80 shadow-sm"
                              onClick={() => setShowChangePassword(true)}
                              type="button"
                            >
                              {copy.settings.profile.changePassword || (lang === "ru" ? "Сменить пароль" : "Change password")}
                            </button>
                          ) : (
                            <form onSubmit={handleChangePassword} className="p-4 rounded-[1.3rem] bg-surface-strong border border-border flex flex-col gap-3 shadow-inner">
                              <h3 className="text-sm font-black text-foreground">{lang === "ru" ? "Смена пароля" : "Change Password"}</h3>
                              
                              <div>
                                <label className="block text-[10px] text-foreground/50 uppercase tracking-wider font-black mb-1.5">{lang === "ru" ? "Текущий пароль" : "Current Password"}</label>
                                <input
                                  id="security_current_password"
                                  name="security_current_password"
                                  type="password"
                                  className="w-full min-h-10 px-3 rounded-xl border border-border/80 bg-background/50 text-sm font-medium text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                                  value={currentPassword}
                                  onChange={(e) => setCurrentPassword(e.target.value)}
                                  disabled={passwordLoading}
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-foreground/50 uppercase tracking-wider font-black mb-1.5">{lang === "ru" ? "Новый пароль" : "New Password"}</label>
                                <input
                                  id="security_new_password"
                                  name="security_new_password"
                                  type="password"
                                  className="w-full min-h-10 px-3 rounded-xl border border-border/80 bg-background/50 text-sm font-medium text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  disabled={passwordLoading}
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-foreground/50 uppercase tracking-wider font-black mb-1.5">{lang === "ru" ? "Подтвердите пароль" : "Confirm Password"}</label>
                                <input
                                  id="security_confirm_password"
                                  name="security_confirm_password"
                                  type="password"
                                  className="w-full min-h-10 px-3 rounded-xl border border-border/80 bg-background/50 text-sm font-medium text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  disabled={passwordLoading}
                                  required
                                />
                              </div>

                              {passwordError && (
                                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                  <p className="text-[11px] text-rose-500 font-bold leading-tight">{passwordError}</p>
                                </div>
                              )}

                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  disabled={passwordLoading}
                                  onClick={() => {
                                    setShowChangePassword(false);
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmPassword("");
                                    setPasswordError("");
                                  }}
                                  className="flex-1 min-h-10 rounded-xl border border-border bg-background text-foreground/80 text-xs font-bold hover:bg-surface-strong transition flex items-center justify-center shadow-sm"
                                >
                                  {lang === "ru" ? "Отмена" : "Cancel"}
                                </button>
                                <button
                                  type="submit"
                                  disabled={passwordLoading}
                                  className="flex-[1.5] min-h-10 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {passwordLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                  {lang === "ru" ? "Сохранить пароль" : "Save Password"}
                                </button>
                              </div>
                            </form>
                          )}
                        </>
                      )}
                      
                      <button
                        className="w-full min-h-11 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 font-bold transition flex items-center justify-center gap-2 text-sm shadow-sm"
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
          )}
        </section>
      </div>
    </main>
  );
}
