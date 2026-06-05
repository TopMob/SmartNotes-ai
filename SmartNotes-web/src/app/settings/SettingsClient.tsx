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
  UserRound,
  RefreshCw,
  Trash2,
  X,
  Loader2,
  Edit2,
  Folder,
  Layout,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Minus,
  AlignLeft,
  Image as ImageIcon,
  Eraser,
  Undo2,
  Link as LinkIcon,
  Files,
  Tag,
  ChevronUp,
  ChevronDown,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { CustomThemePreset, EditorToolKey, UserSettings } from "@/entities/settings";
import { useAuthActions } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useFoldersQuery } from "@/features/folders/hooks/use-folders-query";
import { useNoteActions } from "@/features/notes/hooks/use-note-mutations";
import { useNotesFlat } from "@/features/notes/hooks/use-notes-query";
import { parseImportedNotesFile } from "@/features/notes/lib/note-import";
import { useSettingsActions } from "@/features/settings/hooks/use-settings-mutations";
import { useSettingsQuery } from "@/features/settings/hooks/use-settings-query";
import { DEFAULT_EDITOR_SETTINGS, DEFAULT_USER_SETTINGS } from "@/features/settings/lib/settings-defaults";
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
  { id: "workspace", icon: SlidersHorizontal },
  { id: "data", icon: Database },
  { id: "profile", icon: UserRound },
] as const;

const themePresets = ["classic", "smarthub", "smartlib", "cyber", "lego", "paper"] as const;

type SettingsClientProps = {
  initialDriveConnected: boolean;
};

export default function SettingsClient({ initialDriveConnected }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("appearance");
  const [presetName, setPresetName] = useState("");
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState("");
  const { data: settings, isLoading: _isLoading, error } = useSettingsQuery();
  const { data: folders = [] } = useFoldersQuery();
  const { data: notes = [] } = useNotesFlat();
  const user = useAuthStore((state) => state.user);
  const developerMode = useUiStore((s) => s.developerMode);
  
  const [notesPerPageInput, setNotesPerPageInput] = useState("10");
  
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
  const [username, setUsername] = useState("");
  const [hasChangedUsername, setHasChangedUsername] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const defaultUser = user?.email ? user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") : "";
  const savedUser = (typeof window !== "undefined" && window.localStorage.getItem("smartnotes:custom-username")) || defaultUser;
  const isNameChanged = displayName.trim() !== (user?.displayName ?? "");
  const isLoginChanged = !hasChangedUsername && username.trim() !== savedUser;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("smartnotes:custom-username");
      const hasChanged = window.localStorage.getItem("smartnotes:has-changed-username") === "true";
      setHasChangedUsername(hasChanged);
      if (saved) {
        setUsername(saved);
        return;
      }
    }
    if (user?.email) {
      const defaultUsername = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      setUsername(defaultUsername);
    }
  }, [user]);

  const [uidCopied, setUidCopied] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isExportFolderModalOpen, setIsExportFolderModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionText: string;
    cancelText: string;
    variant: "destructive" | "primary";
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    actionText: "",
    cancelText: "",
    variant: "destructive",
    onConfirm: () => {},
    onCancel: () => {},
  });

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

  useEffect(() => {
    if (draftSettings?.notesPerPage !== undefined) {
      setNotesPerPageInput(draftSettings.notesPerPage.toString());
    }
  }, [draftSettings?.notesPerPage]);

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

  // --- AUTO-SAVE EFFECT ---
  useEffect(() => {
    if (!draftSettings || !settings) return;

    const a = { ...settings, updatedAt: undefined };
    const b = { ...draftSettings, updatedAt: undefined };
    const hasChanges = JSON.stringify(a) !== JSON.stringify(b);
    if (!hasChanges) return;

    setSettingsSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await patchSettings(draftSettings);
        setSettingsSaveStatus("saved");
        const resetTimer = setTimeout(() => setSettingsSaveStatus("idle"), 2000);
        return () => clearTimeout(resetTimer);
      } catch {
        setSettingsSaveStatus("error");
        const resetTimer = setTimeout(() => setSettingsSaveStatus("idle"), 3000);
        return () => clearTimeout(resetTimer);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [draftSettings, settings, patchSettings]);

  function handleUpdateDraft(updater: (prev: UserSettings) => UserSettings) {
    setDraftSettings((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
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
    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Экспорт заметок?" : "Export notes?",
      description: lang === "ru"
        ? `Вы собираетесь экспортировать все ваши заметки (${notes.filter((note) => !note.lock?.hidden).length} шт.) в JSON-файл.`
        : `You are about to export all your notes (${notes.filter((note) => !note.lock?.hidden).length} pcs) to a JSON file.`,
      actionText: lang === "ru" ? "Экспортировать" : "Export",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "primary",
      onConfirm: () => {
        const exportable = notes.filter((note) => !note.lock?.hidden);
        downloadTextFile(`smartnotes-all-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: exportable }, null, 2), "application/json;charset=utf-8");
      }
    });
  }

  async function handleResetSettings() {
    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Сбросить настройки?" : "Reset settings?",
      description: lang === "ru"
        ? "Вы уверены, что хотите сбросить все настройки? Это сбросит абсолютно всё, включая тему, оформление, язык и параметры редактора."
        : "Are you sure you want to reset all settings? This will reset everything, including the theme, appearance, language, and editor settings.",
      actionText: lang === "ru" ? "Сбросить" : "Reset",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const defaults = {
            ...DEFAULT_USER_SETTINGS,
            editor: DEFAULT_EDITOR_SETTINGS,
          };
          setDraftSettings(JSON.parse(JSON.stringify(defaults)));
          await resetSettings();
        } catch {
          if (settings) {
            setDraftSettings(JSON.parse(JSON.stringify(settings)));
          }
        }
      }
    });
  }

  function handleResetPageCache() {
    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Сбросить кэш страницы?" : "Reset page cache?",
      description: lang === "ru"
        ? "Это действие полностью очистит все локальные данные, куки и временные файлы на этом сайте. Вы будете разлогинены."
        : "This will completely clear all local data, cookies, and temporary files on this site. You will be logged out.",
      actionText: lang === "ru" ? "Сбросить и выйти" : "Reset and log out",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        if (typeof window !== "undefined") {
          window.localStorage.clear();
          window.sessionStorage.clear();
          const cookies = document.cookie.split(";");
          for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
          if (window.caches) {
            try {
              const keys = await window.caches.keys();
              await Promise.all(keys.map(key => window.caches.delete(key)));
            } catch (e) {
              console.error(e);
            }
          }
        }
        await logout();
      }
    });
  }

  function handleResetAppearance() {
    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Сбросить внешний вид?" : "Reset appearance?",
      description: lang === "ru" 
        ? "Вы уверены, что хотите сбросить все настройки внешнего вида к значениям по умолчанию? Это действие нельзя отменить."
        : "Are you sure you want to reset all appearance settings to their defaults? This action cannot be undone.",
      actionText: lang === "ru" ? "Сбросить" : "Reset",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "destructive",
      onConfirm: () => {
        handleUpdateDraft((prev) => ({
          ...prev,
          preset: DEFAULT_USER_SETTINGS.preset,
          mainBackgroundUrl: DEFAULT_USER_SETTINGS.mainBackgroundUrl,
          sidebarBackgroundUrl: DEFAULT_USER_SETTINGS.sidebarBackgroundUrl,
          uiOpacity: DEFAULT_USER_SETTINGS.uiOpacity,
          cardsOpacity: DEFAULT_USER_SETTINGS.cardsOpacity,
        }));
      }
    });
  }

  function copyUid() {
    const uid = user?.id ?? "";
    void navigator.clipboard.writeText(uid).then(() => {
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    });
  }

  async function handleSaveProfileData(updates: { displayName?: string; photoURL?: string | null }) {
    setProfileSaveStatus("saving");
    try {
      await updateProfile(updates);
      setProfileSaveStatus("saved");
      setTimeout(() => setProfileSaveStatus("idle"), 2000);
    } catch {
      setProfileSaveStatus("error");
      setTimeout(() => setProfileSaveStatus("idle"), 3000);
    }
  }

  function handleSaveUsername() {
    if (hasChangedUsername) return;
    const trimmed = username.trim();
    if (!trimmed || trimmed === savedUser) return;

    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Изменить логин?" : "Change login?",
      description: lang === "ru"
        ? "Вы уверены? Вы больше не сможете изменить логин, так как он используется для входа."
        : "Are you sure? You will not be able to change your login again, as it is used for signing in.",
      actionText: lang === "ru" ? "Изменить" : "Change",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "primary",
      onConfirm: async () => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("smartnotes:custom-username", trimmed);
          window.localStorage.setItem("smartnotes:has-changed-username", "true");
        }
        setHasChangedUsername(true);
        setProfileSaveStatus("saving");
        try {
          await handleSaveProfileData({});
          setProfileSaveStatus("saved");
          setTimeout(() => setProfileSaveStatus("idle"), 2000);
        } catch {
          setProfileSaveStatus("error");
          setTimeout(() => setProfileSaveStatus("idle"), 3000);
        }
      },
      onCancel: () => {
        setUsername(savedUser);
      }
    });
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
        void handleSaveProfileData({ photoURL: publicUrl });
      } catch (e) {
        console.error(e);
        setProfileSaveStatus("error");
        setTimeout(() => setProfileSaveStatus("idle"), 3000);
      }
    };
    picker.click();
  }

  function renderStatus(status: "idle" | "saving" | "saved" | "error") {
    if (status === "idle") return null;
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold transition-all animate-in fade-in duration-200">
        {status === "saving" && (
          <span className="flex items-center gap-1 text-foreground/50 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
            <span>{lang === "ru" ? "Сохранение..." : "Saving..."}</span>
          </span>
        )}
        {status === "saved" && (
          <span className="flex items-center gap-1 text-emerald-500">
            <Check className="h-3.5 w-3.5" />
            <span>{lang === "ru" ? "Сохранено" : "Saved"}</span>
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-rose-500">
            <X className="h-3.5 w-3.5" />
            <span>{lang === "ru" ? "Ошибка" : "Error"}</span>
          </span>
        )}
      </div>
    );
  }

  async function handleDisconnectDrive() {
    setConfirmModal({
      isOpen: true,
      title: lang === "ru" ? "Отключить Google Диск?" : "Disconnect Google Drive?",
      description: lang === "ru"
        ? "Вы уверены, что хотите отключить Google Диск?"
        : "Are you sure you want to disconnect Google Drive?",
      actionText: lang === "ru" ? "Отключить" : "Disconnect",
      cancelText: lang === "ru" ? "Отмена" : "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const response = await fetch("/api/media/google-drive/disconnect", { method: "POST" });
          if (response.ok) {
            setDriveConnected(false);
          } else {
            throw new Error("Failed to disconnect");
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  const editorGroups = useMemo(() => [
    ["toolbarVisible", lang === "ru" ? "Тулбар форматирования" : "Formatting toolbar", Layout],
    ["bold", lang === "ru" ? "Жирный шрифт" : "Bold text", Bold],
    ["italic", lang === "ru" ? "Курсив" : "Italic text", Italic],
    ["underline", lang === "ru" ? "Подчеркнутый шрифт" : "Underline text", Underline],
    ["strike", lang === "ru" ? "Зачеркнутый шрифт" : "Strikethrough text", Strikethrough],
    ["bullets", lang === "ru" ? "Маркированный список" : "Bullet list", List],
    ["numbered", lang === "ru" ? "Нумерация списков" : "Numbered list", ListOrdered],
    ["hr", lang === "ru" ? "Разделительная линия" : "Horizontal divider", Minus],
    ["alignText", lang === "ru" ? "Выравнивание текста" : "Text alignment", AlignLeft],
    ["alignMedia", lang === "ru" ? "Выравнивание медиа" : "Media alignment", ImageIcon],
    ["clearFormat", lang === "ru" ? "Очистить форматирование" : "Clear formatting", Eraser],
    ["undoRedo", lang === "ru" ? "Отмена / Повтор (Undo / Redo)" : "Undo / Redo controls", Undo2],
    ["links", lang === "ru" ? "Вставка ссылок" : "Insert links", LinkIcon],
    ["pages", lang === "ru" ? "Многостраничность заметки" : "Note pages", Files],
    ["inlineTags", lang === "ru" ? "Тегирование (Inline tags)" : "Inline tag chips", Tag],
  ] as const, [lang]);

  const editorCategories = useMemo(() => [
    {
      title: lang === "ru" ? "Интерфейс" : "Interface",
      keys: ["toolbarVisible", "undoRedo", "pages"] as const
    },
    {
      title: lang === "ru" ? "Форматирование текста" : "Text Formatting",
      keys: ["bold", "italic", "underline", "strike", "clearFormat"] as const
    },
    {
      title: lang === "ru" ? "Списки и разметка" : "Lists & Structure",
      keys: ["bullets", "numbered", "hr"] as const
    },
    {
      title: lang === "ru" ? "Выравнивание" : "Alignment",
      keys: ["alignText", "alignMedia"] as const
    },
    {
      title: lang === "ru" ? "Интерактивность" : "Interactive Elements",
      keys: ["links", "inlineTags"] as const
    }
  ], [lang]);


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
              <Panel title={copy.settings.appearance.themePresets} rightElement={renderStatus(settingsSaveStatus)}>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{lang === "ru" ? "Пресеты" : "Presets"}</span>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2.5">
                    {themePresets.map((item) => (
                      <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.preset === item ? "border-accent bg-accent/10 text-accent ring-2 ring-accent/20" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => applyBuiltInPreset(item)} type="button">
                        {item}
                      </button>
                    ))}
                  </div>
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
                    <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{copy.settings.appearance.mainBackgroundUrl}</span>
                    {draftSettings.mainBackgroundUrl ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2 transition hover:border-border/80">
                        <img src={draftSettings.mainBackgroundUrl} className="h-12 w-12 rounded-xl object-cover border border-border" alt="Workspace background" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-foreground truncate">{lang === "ru" ? "Активный фон" : "Active background"}</p>
                          <p className="text-[10px] text-foreground/50 truncate">{draftSettings.mainBackgroundUrl}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateDraft(p => ({ ...p, mainBackgroundUrl: null }))}
                          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void uploadBackground("mainBackgroundUrl")}
                        className="flex min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background hover:bg-surface-strong transition-all duration-200 active:scale-[0.99] group"
                      >
                        <Plus className="h-4 w-4 text-foreground/40 group-hover:text-accent transition" />
                        <span className="text-xs font-bold text-foreground/60 group-hover:text-foreground transition">{lang === "ru" ? "Выбрать изображение" : "Select image"}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{copy.settings.appearance.sidebarBackgroundUrl}</span>
                    {draftSettings.sidebarBackgroundUrl ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2 transition hover:border-border/80">
                        <img src={draftSettings.sidebarBackgroundUrl} className="h-12 w-12 rounded-xl object-cover border border-border" alt="Sidebar background" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-foreground truncate">{lang === "ru" ? "Активный фон" : "Active background"}</p>
                          <p className="text-[10px] text-foreground/50 truncate">{draftSettings.sidebarBackgroundUrl}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateDraft(p => ({ ...p, sidebarBackgroundUrl: null }))}
                          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void uploadBackground("sidebarBackgroundUrl")}
                        className="flex min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background hover:bg-surface-strong transition-all duration-200 active:scale-[0.99] group"
                      >
                        <Plus className="h-4 w-4 text-foreground/40 group-hover:text-accent transition" />
                        <span className="text-xs font-bold text-foreground/60 group-hover:text-foreground transition">{lang === "ru" ? "Выбрать изображение" : "Select image"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.localeAndLayout} rightElement={renderStatus(settingsSaveStatus)}>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{lang === "ru" ? "Язык интерфейса" : "Language"}</span>
                  <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                    {(["ru", "en"] as const).map((item) => (
                      <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.lang === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => handleUpdateDraft(p => ({ ...p, lang: item }))} type="button">
                        {item.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{lang === "ru" ? "Количество заметок на странице" : "Notes per page"}</span>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2.5">
                    {([10, 30, 50, 100] as const).map((item) => (
                      <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-xs font-black sm:text-sm transition ${draftSettings.notesPerPage === item ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} key={item} onClick={() => handleUpdateDraft(p => ({ ...p, notesPerPage: item }))} type="button">
                        {lang === "ru" ? `${item} на стр.` : `${item} / page`}
                      </button>
                    ))}
                    {(() => {
                      const isCustom = ![10, 30, 50, 100].includes(draftSettings.notesPerPage);
                      return (
                        <div 
                          className={`col-span-2 xs:col-span-1 flex items-center px-4 py-1.5 min-h-11 rounded-2xl border cursor-pointer transition ${isCustom ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground"}`}
                          onClick={() => document.getElementById("notes_per_page_custom")?.focus()}
                        >
                          <div className="relative flex items-center justify-between w-full">
                            <div className="flex-1 flex justify-center pl-4">
                              <input
                                id="notes_per_page_custom"
                                name="notes_per_page_custom"
                                type="text"
                                className="w-12 bg-transparent text-xs font-bold text-center outline-none border-b border-foreground/20 focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={notesPerPageInput}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  setNotesPerPageInput(raw);
                                }}
                                onBlur={() => {
                                  const num = parseInt(notesPerPageInput) || 10;
                                  const clamped = Math.min(1000, Math.max(1, num));
                                  setNotesPerPageInput(clamped.toString());
                                  handleUpdateDraft(p => ({ ...p, notesPerPage: clamped }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const num = parseInt(notesPerPageInput) || 10;
                                    const clamped = Math.min(1000, Math.max(1, num));
                                    setNotesPerPageInput(clamped.toString());
                                    handleUpdateDraft(p => ({ ...p, notesPerPage: clamped }));
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder="..."
                              />
                            </div>
                            <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="p-0.5 text-foreground/50 hover:text-accent transition active:scale-75"
                                onClick={() => {
                                  const current = parseInt(notesPerPageInput) || 10;
                                  const val = Math.min(1000, current + 1);
                                  setNotesPerPageInput(val.toString());
                                  handleUpdateDraft(p => ({ ...p, notesPerPage: val }));
                                }}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="p-0.5 text-foreground/50 hover:text-accent transition active:scale-75"
                                onClick={() => {
                                  const current = parseInt(notesPerPageInput) || 10;
                                  const val = Math.max(1, current - 1);
                                  setNotesPerPageInput(val.toString());
                                  handleUpdateDraft(p => ({ ...p, notesPerPage: val }));
                                }}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{lang === "ru" ? "Анимации и эффекты" : "Animations and effects"}</span>
                  <button className={`min-h-11 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm transition ${draftSettings.reduceMotion ? "border-accent bg-accent/10 text-accent" : "border-border bg-background hover:bg-surface-strong"}`} onClick={() => handleUpdateDraft(p => ({ ...p, reduceMotion: !p.reduceMotion }))} type="button">
                    {lang === "ru" ? `Упрощенные анимации: ${draftSettings.reduceMotion ? "Вкл" : "Выкл"}` : `Reduce motion: ${draftSettings.reduceMotion ? "On" : "Off"}`}
                  </button>
                </div>
              </Panel>

              <Panel title={copy.settings.appearance.customPresets}>
                <div className="flex justify-start">
                  <button 
                    className="w-full sm:w-auto min-h-11 rounded-2xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 shadow-sm flex items-center justify-center gap-2" 
                    onClick={() => {
                      setPresetName("");
                      setIsSavePresetModalOpen(true);
                    }} 
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    {copy.settings.appearance.savePreset}
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
              
              <div className="pt-6 border-t border-border/40 flex justify-center">
                <button 
                  className="w-full sm:w-auto min-h-11 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 px-6 py-2.5 text-xs font-bold text-rose-500 transition active:scale-95 flex items-center justify-center gap-2" 
                  onClick={handleResetAppearance} 
                  type="button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {copy.settings.appearance.resetAppearance}
                </button>
              </div>
            </div>
          )}

          {activeSection === "workspace" && (
            <div className="space-y-4">
              <SectionIntro title={lang === "ru" ? "Инструменты" : "Workspace Tools"} text={lang === "ru" ? "Настройка редактора и фильтров для вашего удобства" : "Configure the editor and active filters to match your workflow"} />
              
              <Panel title={copy.settings.editor.tools} rightElement={renderStatus(settingsSaveStatus)}>
                <div className="space-y-6">
                  {editorCategories.map((category) => (
                    <div key={category.title} className="space-y-2">
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/45">
                        {category.title}
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {category.keys.map((key) => {
                          const group = editorGroups.find((g) => g[0] === key);
                          if (!group) return null;
                          const [, label, Icon] = group;
                          return (
                            <button
                              className={`flex w-full min-w-0 min-h-11 items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-xs font-bold sm:text-sm transition hover:bg-surface-strong ${
                                draftSettings.editor[key]
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border bg-background"
                              }`}
                              key={key}
                              onClick={() => toggleEditorTool(key)}
                              type="button"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className={`h-4 w-4 shrink-0 ${draftSettings.editor[key] ? "text-accent" : "text-foreground/50"}`} />
                                <span className="truncate pr-3">{label}</span>
                              </div>
                              <span>{draftSettings.editor[key] ? copy.settings.editor.on : copy.settings.editor.off}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title={copy.settings.filters.sections} rightElement={renderStatus(settingsSaveStatus)}>
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
                  <button className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={() => { setSelectedFolderId(null); setIsExportFolderModalOpen(true); }} type="button">
                    <FileJson className="h-4 w-4" />
                    {copy.settings.data.exportFolder}
                  </button>
                  <button className="w-full min-h-11 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold sm:text-sm transition hover:bg-surface-strong shadow-sm" onClick={handleResetPageCache} type="button">
                    {copy.settings.data.resetCache}
                  </button>
                </div>
              </Panel>

              <Panel title={lang === "ru" ? "Хранилище медиа" : "Media Storage"}>
                <div className="rounded-[1.2rem] border border-border bg-surface-strong p-5 text-sm text-foreground/58 space-y-6">
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0 select-none text-[#3ecf8e]" fill="currentColor">
                          <path d="M21.362 9.354H12V3L2.638 14.646H12V21z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Supabase Storage</p>
                          <p className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                            {lang === "ru" ? "Активно • Всегда 50 КБ" : "Active • Always 50 KB"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 font-bold">
                        {lang === "ru" ? "Системное" : "System"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-background hover:bg-surface-strong transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <svg viewBox="0 0 360 360" className="h-9 w-9 shrink-0 select-none">
                          <path fill="#0066da" d="M124.5 240H322.5L258 322.5H60L124.5 240Z" />
                          <path fill="#00aa47" d="M60 322.5L124.5 240L37.5 90L22.5 115.5L60 322.5Z" />
                          <path fill="#ffba00" d="M258 322.5L322.5 240L186 3.75H171L124.5 240L258 322.5Z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground">Google Drive</p>
                          <p className="text-[11px] font-medium text-foreground/50 truncate">
                            {driveConnected 
                              ? (gdriveDisabled ? (lang === "ru" ? "Интеграция приостановлена" : "Integration paused") : (lang === "ru" ? "Активно" : "Active"))
                              : (lang === "ru" ? "Не подключен" : "Not connected")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {driveConnected ? (
                          <>
                            <button
                              onClick={handleToggleGoogleDrive}
                              className={`h-9 px-3 rounded-xl border text-[11px] font-bold transition-all duration-200 ${
                                gdriveDisabled 
                                  ? "border-accent bg-accent/10 text-accent hover:bg-accent/20" 
                                  : "border-border bg-background text-foreground/70 hover:bg-surface-strong"
                              }`}
                              type="button"
                            >
                              {gdriveDisabled ? (lang === "ru" ? "Включить" : "Enable") : (lang === "ru" ? "Пауза" : "Pause")}
                            </button>
                            <button
                              onClick={() => void handleDisconnectDrive()}
                              className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95"
                              type="button"
                              title={lang === "ru" ? "Отключить" : "Disconnect"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => void connectGoogleDrive()}
                            className="h-9 px-4 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-bold transition shadow-sm"
                            type="button"
                          >
                            {lang === "ru" ? "Войти" : "Sign In"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-foreground/60">
                    {lang === "ru"
                      ? "Supabase автоматически сжимает все изображения до 50 КБ. Подключите свой Google Диск (BYOS), чтобы сохранять файлы в оригинальном качестве или с выбранным уровнем сжатия."
                      : "Supabase auto-compresses images to 50 KB. Link Google Drive (BYOS) to store images in original quality or custom compression level."}
                  </p>

                  <div className="h-px bg-border/60" />

                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42 mb-2">
                      {lang === "ru" ? "Качество сжатия (только для Google Диска)" : "Compression quality (Google Drive only)"}
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

              {developerMode && (
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
              )}

              <div className="pt-6 border-t border-border/40 flex justify-center">
                <button 
                  className="w-full sm:w-auto min-h-11 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 px-6 py-2.5 text-xs font-bold text-rose-500 transition active:scale-95 flex items-center justify-center gap-2" 
                  onClick={handleResetSettings} 
                  type="button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {copy.settings.data.resetSettings}
                </button>
              </div>
            </div>
          )}

          {activeSection === "profile" && (
            <div className="space-y-6">
              <SectionIntro title={copy.settings.profile.title} text={copy.settings.profile.subtitle} />

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title={copy.settings.profile.profileDetails || "Данные профиля"} rightElement={renderStatus(profileSaveStatus)}>
                  <div className="space-y-5">
                    <div className="flex flex-col items-center justify-center p-6 rounded-[1.3rem] bg-surface-strong border border-border">
                      <div className="relative h-24 w-24">
                        <button
                          type="button"
                          onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface shadow-lg text-3xl font-black text-foreground/45 transition hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {avatarUrl ? (
                            <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
                          ) : (
                            <span>{(displayName || user?.email || "?").slice(0, 1).toUpperCase()}</span>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition hover:scale-110 active:scale-95 border-2 border-background"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
 
                        <AnimatePresence>
                          {isAvatarMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsAvatarMenuOpen(false)} 
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 rounded-xl border border-border bg-background p-1.5 shadow-xl z-50 origin-top font-sans"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAvatarMenuOpen(false);
                                    void uploadAvatar();
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-foreground hover:bg-surface-strong transition"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  {lang === "ru" ? "Загрузить фото" : "Upload photo"}
                                </button>
                                {avatarUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAvatarMenuOpen(false);
                                      setAvatarUrl("");
                                      void handleSaveProfileData({ photoURL: null });
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {lang === "ru" ? "Удалить фото" : "Delete photo"}
                                  </button>
                                )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-xs font-bold text-foreground/50">
                          {lang === "ru" ? "Нажмите на аватарку, чтобы изменить фото" : "Tap on avatar to change photo"}
                        </p>
                      </div>
                    </div>
 
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <span className="block mb-1.5 text-xs font-bold text-foreground/70">{copy.settings.profile.displayName}</span>
                        <div className="flex items-center gap-2">
                          <input
                            id="profile_display_name"
                            name="profile_display_name"
                            className="flex-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-normal"
                            onChange={(e) => setDisplayName(e.target.value)}
                            onBlur={() => {
                              if (displayName.trim() !== (user?.displayName ?? "")) {
                                void handleSaveProfileData({ displayName: displayName.trim() });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder={copy.settings.profile.displayNamePlaceholder}
                            type="text"
                            value={displayName}
                          />
                          {isNameChanged && (
                            <button
                              type="button"
                              onClick={() => {
                                if (displayName.trim() !== (user?.displayName ?? "")) {
                                  void handleSaveProfileData({ displayName: displayName.trim() });
                                }
                              }}
                              className="shrink-0 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 transition shadow-md min-h-11 flex items-center justify-center gap-1.5 animate-in slide-in-from-right-2 duration-150"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>{lang === "ru" ? "Сохранить" : "Save"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-foreground/70">{lang === "ru" ? "Логин" : "Login"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="profile_username"
                            name="profile_username"
                            disabled={hasChangedUsername}
                            className="flex-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm min-h-11 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-normal disabled:text-foreground/50 disabled:bg-background/40 disabled:cursor-not-allowed"
                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                            onBlur={handleSaveUsername}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="login"
                            type="text"
                            value={username}
                          />
                          {isLoginChanged && (
                            <button
                              type="button"
                              onClick={handleSaveUsername}
                              className="shrink-0 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 transition shadow-md min-h-11 flex items-center justify-center gap-1.5 animate-in slide-in-from-right-2 duration-150"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>{lang === "ru" ? "Сохранить" : "Save"}</span>
                            </button>
                          )}
                        </div>
                        {!hasChangedUsername && (
                          <p className="mt-1.5 text-[10px] text-foreground/45">
                            {lang === "ru" ? "Можно изменить только один раз" : "Can only be changed once"}
                          </p>
                        )}
                      </div>
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
                      <span className="block mb-2 text-xs font-bold text-foreground/70">{lang === "ru" ? "Способы входа" : "Sign-in methods"}</span>
                      <div className="space-y-2 font-sans">
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{lang === "ru" ? "Почта" : "Email"}</span>
                            <span className="text-[10px] text-foreground/50 font-normal">({user?.email})</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                            {lang === "ru" ? "Активно" : "Active"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{lang === "ru" ? "Логин" : "Login"}</span>
                            <span className="text-[10px] text-foreground/50 font-normal">({username || "..."})</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                            {lang === "ru" ? "Активно" : "Active"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">Google</span>
                            <span className="text-[10px] text-foreground/50 font-normal truncate max-w-[120px] sm:max-w-none">
                              {googleLinked ? `${user?.displayName || "Google User"}` : (lang === "ru" ? "Не привязан" : "Not linked")}
                            </span>
                          </div>
                          {googleLinked ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                              {lang === "ru" ? "Привязано" : "Linked"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setGoogleLinked(true)}
                              className="text-[10px] bg-accent text-accent-foreground px-2 py-1 rounded-md hover:bg-accent/90 transition shrink-0"
                            >
                              {lang === "ru" ? "Привязать" : "Link"}
                            </button>
                          )}
                        </div>
                      </div>
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
                      <div className="p-4 rounded-[1.3rem] bg-surface-strong border border-border text-xs text-foreground/60 font-bold flex items-center justify-between">
                        <span className="text-[10px] text-foreground/45 uppercase tracking-wider font-black">{copy.settings.profile.registeredAt || "Регистрация"}</span>
                        <span>
                          {new Date(user.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
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
      <AnimatePresence>
        {isExportFolderModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="w-full max-w-md overflow-hidden rounded-[1.6rem] border border-border bg-surface p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-foreground">
                  {lang === "ru" ? "Экспорт папки" : "Export Folder"}
                </h3>
                <button
                  onClick={() => setIsExportFolderModalOpen(false)}
                  className="rounded-lg p-1.5 text-foreground/50 hover:bg-surface-strong hover:text-foreground transition"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-foreground/60 mb-4 font-medium leading-relaxed">
                {lang === "ru"
                  ? "Выберите папку для экспорта всех содержащихся в ней заметок в файл формата JSON."
                  : "Select a folder to export all notes within it to a JSON file."}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-6">
                {folders.filter(f => !f.trashedAt).length === 0 ? (
                  <div className="text-center py-6 text-xs text-foreground/42">
                    {lang === "ru" ? "Нет доступных папок для экспорта." : "No folders available for export."}
                  </div>
                ) : (
                  folders
                    .filter(f => !f.trashedAt)
                    .map((folder) => {
                      const isSelected = selectedFolderId === folder.id;
                      return (
                        <button
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs font-bold transition ${
                            isSelected
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-surface-strong hover:bg-border/30 text-foreground"
                          }`}
                          type="button"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Folder className={`h-4 w-4 shrink-0 ${isSelected ? "text-accent" : "text-foreground/50"}`} />
                            <span className="truncate">{folder.name}</span>
                          </div>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                        </button>
                      );
                    })
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsExportFolderModalOpen(false)}
                  className="flex-1 min-h-11 rounded-xl border border-border bg-background hover:bg-surface-strong transition text-xs font-bold"
                  type="button"
                >
                  {lang === "ru" ? "Отмена" : "Cancel"}
                </button>
                <button
                  onClick={() => {
                    if (!selectedFolderId) return;
                    const folder = folders.find((f) => f.id === selectedFolderId);
                    if (!folder) return;
                    const exportable = notes.filter((n) => n.folderId === folder.id && !n.lock?.hidden);
                    downloadTextFile(
                      `${safeFileName(`smartnotes-folder-${folder.name}`)}.json`,
                      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), folderId: folder.id, folderName: folder.name, notes: exportable }, null, 2),
                      "application/json;charset=utf-8"
                    );
                    setIsExportFolderModalOpen(false);
                  }}
                  disabled={!selectedFolderId}
                  className="flex-1 min-h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition text-xs font-bold"
                  type="button"
                >
                  {lang === "ru" ? "Экспортировать" : "Export"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="w-full max-w-sm overflow-hidden rounded-[1.6rem] border border-border bg-surface p-6 shadow-2xl"
            >
              <h3 className="text-base font-black text-foreground mb-2">
                {confirmModal.title}
              </h3>

              <p className="text-xs text-foreground/60 mb-6 font-medium leading-relaxed font-sans">
                {confirmModal.description}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    confirmModal.onCancel?.();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 min-h-11 rounded-xl border border-border bg-background hover:bg-surface-strong transition text-xs font-bold"
                  type="button"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await confirmModal.onConfirm();
                    } finally {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                  }}
                  className={`flex-1 min-h-11 rounded-xl transition text-xs font-bold ${
                    confirmModal.variant === "destructive"
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-accent text-accent-foreground hover:bg-accent/90"
                  }`}
                  type="button"
                >
                  {confirmModal.actionText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSavePresetModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="w-full max-w-sm overflow-hidden rounded-[1.6rem] border border-border bg-surface p-6 shadow-2xl"
            >
              <h3 className="text-base font-black text-foreground mb-2">
                {lang === "ru" ? "Сохранить пресет темы" : "Save theme preset"}
              </h3>

              <p className="text-xs text-foreground/60 mb-4 font-medium leading-relaxed font-sans">
                {lang === "ru" 
                  ? "Введите имя для сохранения текущих настроек темы, фонов и прозрачности."
                  : "Enter a name to save your current theme, background, and opacity settings."}
              </p>

              <input
                id="modal_preset_name"
                name="modal_preset_name"
                type="text"
                autoFocus
                className="w-full mb-6 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-normal"
                placeholder={lang === "ru" ? "Мой пресет" : "My Preset"}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && presetName.trim()) {
                    saveCurrentThemePreset(presetName.trim());
                    setIsSavePresetModalOpen(false);
                  }
                }}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setIsSavePresetModalOpen(false)}
                  className="flex-1 min-h-11 rounded-xl border border-border bg-background hover:bg-surface-strong transition text-xs font-bold"
                  type="button"
                >
                  {lang === "ru" ? "Отмена" : "Cancel"}
                </button>
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      saveCurrentThemePreset(presetName.trim());
                      setIsSavePresetModalOpen(false);
                    }
                  }}
                  disabled={!presetName.trim()}
                  className="flex-1 min-h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition text-xs font-bold"
                  type="button"
                >
                  {lang === "ru" ? "Сохранить" : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
