import { ArrowLeft, Bell, Database, Eye, Languages, PanelLeft, Palette, SlidersHorizontal, Type } from "lucide-react";
import Link from "next/link";

const sections = [
  { title: "Внешний вид", icon: Palette, active: true },
  { title: "Редактор", icon: Type },
  { title: "Уведомления", icon: Bell },
  { title: "Данные", icon: Database },
];

const rows = [
  { title: "Темы", text: "Пресеты, фон, прозрачность" },
  { title: "Панель", text: "Всегда держать боковую панель открытой", icon: PanelLeft },
  { title: "Язык", text: "RU / EN", icon: Languages },
  { title: "Доступность", text: "Reduce motion, контраст", icon: Eye },
  { title: "Интерфейс", text: "Видимость секций и кнопок", icon: SlidersHorizontal },
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border border-border bg-surface/88 p-4 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl">
          <Link className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2 text-sm font-bold text-foreground/70 hover:bg-background" href="/">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>

          <h1 className="mt-5 text-3xl font-black tracking-tight">Настройки</h1>
          <p className="mt-2 text-sm leading-6 text-foreground/58">Главный каркас настроек. Детальную логику и поля добавим после того, как ты распишешь точнее структуру.</p>

          <nav className="mt-6 space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;

              return (
                <button className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${section.active ? "bg-foreground text-background" : "hover:bg-surface-strong"}`} key={section.title} type="button">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-black">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="border border-border bg-surface/88 p-5 shadow-2xl shadow-violet-950/8 backdrop-blur-2xl sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Appearance</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Внешний вид</h2>
          <p className="mt-2 max-w-2xl leading-7 text-foreground/62">Пока это чистый раздел-контейнер без фейковых пресетов и лишних демонстрационных карточек.</p>

          <div className="mt-6 space-y-3">
            {rows.map((row) => {
              const Icon = row.icon;

              return (
                <button className="flex w-full items-center gap-3 rounded-[1.4rem] border border-border bg-surface-strong p-4 text-left hover:bg-background" key={row.title} type="button">
                  {Icon ? <Icon className="h-5 w-5 text-accent" /> : <Palette className="h-5 w-5 text-accent" />}
                  <div>
                    <p className="font-black">{row.title}</p>
                    <p className="mt-1 text-sm text-foreground/56">{row.text}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
