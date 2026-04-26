import { ArrowLeft, Bell, Brush, Database, Eye, Languages, LayoutDashboard, Palette, SlidersHorizontal, Type } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

const sections = [
  { title: "Внешний вид", text: "Темы должны радикально менять поверхности, фон, blur, density и typography.", icon: Palette, active: true },
  { title: "Редактор", text: "Toolbar, math resolver, canvas, media actions и доступность инструментов.", icon: Type },
  { title: "Уведомления", text: "Permission prompts, локальный scheduler и reminder events.", icon: Bell },
  { title: "Данные", text: "Offline cache, sync_queue, import/export и local eviction policy.", icon: Database },
];

const themePresets = [
  "Warm Paper",
  "Deep Focus",
  "Glass Mint",
  "OLED Night",
  "High Contrast",
  "Soft Sakura",
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Настройки</h1>
          <p className="mt-2 text-sm leading-6 text-foreground/58">Единый центр appearance, editor tools, PWA, sync и privacy.</p>

          <nav className="mt-6 space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;

              return (
                <button
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${section.active ? "bg-foreground text-background" : "hover:bg-surface-strong"}`}
                  key={section.title}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-black">{section.title}</span>
                    <span className={`mt-1 block text-xs leading-5 ${section.active ? "text-background/62" : "text-foreground/52"}`}>{section.text}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[2rem] border border-border bg-surface/88 p-5 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Appearance</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Темы и плотность</h2>
                <p className="mt-2 max-w-2xl leading-7 text-foreground/62">
                  В новой версии тема не просто меняет цвет accent, а полностью переключает визуальный язык приложения.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Сбросить</Button>
                <Button>Сохранить</Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {themePresets.map((preset, index) => (
                <button className="rounded-[1.5rem] border border-border bg-surface-strong p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-950/8" key={preset}>
                  <div className={`h-24 rounded-2xl ${index % 3 === 0 ? "bg-gradient-to-br from-violet-300 via-stone-100 to-emerald-200" : index % 3 === 1 ? "bg-gradient-to-br from-zinc-950 via-violet-950 to-slate-800" : "bg-gradient-to-br from-cyan-100 via-white to-rose-100"}`} />
                  <p className="mt-3 font-black">{preset}</p>
                  <p className="mt-1 text-sm text-foreground/52">Surface, border, blur, radius, shadows</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {[
              ["Интерфейс", "showSavedFilters, tag filter, updated period", LayoutDashboard],
              ["Фоны", "URL, локальный файл, direct image validation", Brush],
              ["Доступность", "reduce motion, contrast, density", Eye],
              ["Язык", "RU / EN", Languages],
              ["Opacity", "UI и card opacity", SlidersHorizontal],
              ["Editor tools", "Feature flags для модулей", Type],
            ].map(([title, text, Icon]) => {
              const TypedIcon = Icon as typeof LayoutDashboard;

              return (
                <article className="rounded-[1.5rem] border border-border bg-surface/88 p-4 shadow-lg shadow-violet-950/5 backdrop-blur-2xl" key={title as string}>
                  <TypedIcon className="h-5 w-5 text-accent" />
                  <h3 className="mt-3 font-black">{title as string}</h3>
                  <p className="mt-1 text-sm leading-6 text-foreground/58">{text as string}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
