import {
  Archive,
  Bell,
  Brain,
  CalendarClock,
  ChevronRight,
  Cloud,
  FileDown,
  Folder,
  Heart,
  Inbox,
  Lock,
  Menu,
  Mic,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  Wifi,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

const navItems = [
  { label: "Заметки", count: 128, icon: Inbox, active: true },
  { label: "Избранное", count: 18, icon: Heart },
  { label: "Напоминания", count: 6, icon: Bell },
  { label: "Архив", count: 24, icon: Archive },
  { label: "Lock Center", count: 7, icon: Lock },
  { label: "Корзина", count: 3, icon: Trash2 },
];

const folders = [
  { name: "Работа", noteCount: 34, color: "bg-violet-500" },
  { name: "Идеи продукта", noteCount: 21, color: "bg-cyan-500" },
  { name: "Учеба", noteCount: 17, color: "bg-amber-500" },
  { name: "Личное", noteCount: 12, color: "bg-emerald-500" },
];

const notes = [
  {
    title: "План BrainEngine pipeline",
    text: "Chunking, hiddenTags, pgvector retrieval, folder routing и resurfacing score. Нужно проверить retry policy для pending queue.",
    folder: "Идеи продукта",
    tags: ["ai", "vector", "priority"],
    time: "12 мин назад",
    pinned: true,
    status: "AI done",
    accent: "from-violet-500/24 to-cyan-400/18",
  },
  {
    title: "Купить билеты и поставить reminder",
    text: "До пятницы выбрать время, сохранить PDF и добавить уведомление за 2 часа до выхода.",
    folder: "Личное",
    tags: ["reminder", "travel"],
    time: "Сегодня, 09:40",
    pinned: false,
    status: "Reminder",
    accent: "from-amber-400/24 to-orange-300/16",
  },
  {
    title: "BYOS media: Google Drive proxy",
    text: "Пользовательские файлы остаются на Drive. В заметке храним descriptor: fileId, mime, thumbnailUrl, размеры.",
    folder: "Работа",
    tags: ["media", "drive"],
    time: "Вчера",
    pinned: false,
    status: "Pending AI",
    accent: "from-emerald-400/22 to-sky-400/16",
  },
];

const actionCards = [
  { title: "AI анализ", text: "12 заметок ждут semantic pipeline", icon: Brain },
  { title: "Sync queue", text: "Offline изменения готовы к отправке", icon: Wifi },
  { title: "BYOS медиа", text: "Загрузка через Drive proxy", icon: Cloud },
  { title: "Экспорт", text: "JSON, TXT и print flow", icon: FileDown },
];

const editorTools = ["Bold", "Italic", "List", "Link", "Math", "Canvas", "Media", "Tags"];

export default function HomePage() {
  return (
    <main className="min-h-screen pb-24 text-foreground lg:pb-0">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-4 px-3 py-3 sm:px-5 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:p-5">
        <aside className="hidden rounded-[2rem] border border-border bg-surface/86 p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl lg:flex lg:flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">SmartNotes</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Создал и забыл</h1>
            </div>
            <Button aria-label="Настройки" asChild className="h-10 w-10 px-0" variant="secondary">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Button className="mt-6 h-12 justify-between rounded-2xl text-base">
            Быстрая заметка
            <Plus className="h-5 w-5" />
          </Button>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                    item.active ? "bg-foreground text-background shadow-lg shadow-violet-950/12" : "text-foreground/70 hover:bg-surface-strong"
                  }`}
                  key={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs">{item.count}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-foreground/45">Папки</h2>
            <button className="rounded-full p-2 text-foreground/50 hover:bg-surface-strong" type="button">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {folders.map((folder) => (
              <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" key={folder.name}>
                <span className={`h-3 w-3 rounded-full ${folder.color}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{folder.name}</span>
                <span className="text-xs text-foreground/45">{folder.noteCount}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-3xl bg-foreground p-4 text-background">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4" />
              BrainEngine
            </div>
            <p className="mt-2 text-sm leading-6 text-background/68">Автоклассификация, resurfacing и hybrid search будут работать как единая очередь.</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <header className="sticky top-0 z-20 -mx-3 border-b border-border/60 bg-background/76 px-3 py-3 backdrop-blur-2xl sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:rounded-[2rem] lg:border lg:bg-surface/86 lg:p-4 lg:shadow-xl lg:shadow-violet-950/5">
            <div className="flex items-center gap-3">
              <button className="rounded-2xl border border-border bg-surface-strong p-3 lg:hidden" type="button">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent lg:hidden">SmartNotes</p>
                <h2 className="truncate text-2xl font-black tracking-tight sm:text-3xl">Все заметки</h2>
              </div>
              <Button asChild className="hidden sm:inline-flex" variant="secondary">
                <Link href="/login">Войти</Link>
              </Button>
              <Button className="h-11 w-11 px-0 sm:hidden" aria-label="Создать заметку">
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 shadow-inner shadow-violet-950/4">
                <Search className="h-5 w-5 text-foreground/38" />
                <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/38" placeholder="Найти мысль, тег, папку или смысл..." />
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {[
                  ["AI", Brain],
                  ["Теги", Tag],
                  ["Дата", CalendarClock],
                  ["Темы", Palette],
                ].map(([label, Icon]) => {
                  const TypedIcon = Icon as typeof Brain;

                  return (
                    <button className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm font-bold text-foreground/72" key={label as string}>
                      <TypedIcon className="h-4 w-4" />
                      {label as string}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[2rem] border border-border bg-surface/86 p-3 shadow-xl shadow-violet-950/5 backdrop-blur-2xl sm:p-4">
              <div className="rounded-[1.5rem] bg-foreground p-4 text-background sm:p-5">
                <div className="flex items-start gap-3">
                  <Pencil className="mt-1 h-5 w-5 shrink-0 text-background/70" />
                  <div className="min-w-0 flex-1">
                    <input className="w-full bg-transparent text-xl font-black outline-none placeholder:text-background/45" placeholder="Что нужно запомнить?" />
                    <textarea className="mt-3 min-h-24 w-full resize-none bg-transparent text-base leading-7 outline-none placeholder:text-background/42" placeholder="Запиши быстро. AI сам предложит теги, папку, напоминания и свяжет с похожими заметками." />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button className="bg-background text-foreground hover:bg-background/92">Сохранить</Button>
                  <Button className="border-background/18 bg-background/8 text-background hover:bg-background/14" variant="secondary">
                    <Mic className="mr-2 h-4 w-4" />
                    Голос
                  </Button>
                  <Button className="border-background/18 bg-background/8 text-background hover:bg-background/14" variant="secondary">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Медиа
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {editorTools.map((tool) => (
                  <button className="shrink-0 rounded-full border border-border bg-surface-strong px-3 py-2 text-xs font-bold text-foreground/68" key={tool}>
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
              {actionCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className="rounded-[1.5rem] border border-border bg-surface/86 p-4 shadow-lg shadow-violet-950/5 backdrop-blur-2xl" key={card.title}>
                    <Icon className="h-5 w-5 text-accent" />
                    <h3 className="mt-3 font-black">{card.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/62">{card.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-black">Недавние заметки</h2>
              <button className="text-sm font-bold text-accent" type="button">Сортировка: умная</button>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {notes.map((note) => (
                <article className="overflow-hidden rounded-[1.7rem] border border-border bg-surface/88 shadow-xl shadow-violet-950/5 backdrop-blur-2xl" key={note.title}>
                  <div className={`h-2 bg-gradient-to-r ${note.accent}`} />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {note.pinned && <Pin className="h-4 w-4 fill-accent text-accent" />}
                          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-black text-accent">{note.status}</span>
                          <span className="text-xs font-semibold text-foreground/42">{note.time}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-black tracking-tight">{note.title}</h3>
                      </div>
                      <button className="rounded-full p-2 text-foreground/45 hover:bg-surface-strong" type="button">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-foreground/68">{note.text}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/6 px-3 py-1.5 text-xs font-bold">
                        <Folder className="h-3.5 w-3.5" />
                        {note.folder}
                      </span>
                      {note.tags.map((tag) => (
                        <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground/58" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="hidden space-y-4 lg:block">
          <section className="rounded-[2rem] border border-border bg-surface/86 p-5 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Сегодня</h2>
              <Bell className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-5 space-y-3">
              {["Позвонить по договору", "Проверить AI reindex", "Отправить экспорт папки"].map((item, index) => (
                <div className="flex gap-3 rounded-2xl bg-surface-strong p-3" key={item}>
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-black text-accent">{index + 1}</span>
                  <div>
                    <p className="text-sm font-bold">{item}</p>
                    <p className="mt-1 text-xs text-foreground/45">Напоминание и resurfacing</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-surface/86 p-5 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
            <h2 className="text-lg font-black">Функции</h2>
            <div className="mt-4 space-y-2">
              {[
                ["Шаринг", Share2],
                ["Импорт", UploadCloud],
                ["Hidden folders", Folder],
                ["Настройки", Settings],
              ].map(([label, Icon]) => {
                const TypedIcon = Icon as typeof Share2;

                return (
                  <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-strong" key={label as string}>
                    <TypedIcon className="h-4 w-4 text-accent" />
                    <span className="flex-1 text-sm font-bold">{label as string}</span>
                    <ChevronRight className="h-4 w-4 text-foreground/32" />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[1.5rem] border border-border bg-surface/92 p-2 shadow-2xl shadow-violet-950/16 backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {[
            ["Заметки", Inbox],
            ["Поиск", Search],
            ["Новая", Plus],
            ["AI", Brain],
            ["Еще", Menu],
          ].map(([label, Icon]) => {
            const TypedIcon = Icon as typeof Inbox;

            return (
              <button className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-foreground/62 first:bg-foreground first:text-background" key={label as string}>
                <TypedIcon className="h-5 w-5" />
                {label as string}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
