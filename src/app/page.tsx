import { Brain, Cloud, Lock, PencilRuler, Radar, WifiOff } from "lucide-react";

const modules = [
  {
    title: "Notes Core",
    description: "CRUD, страницы, напоминания, архив, корзина и partial updates.",
    icon: PencilRuler,
  },
  {
    title: "BrainEngine",
    description: "Semantic/vector pipeline для hiddenTags, relevance, resurfacing и folder routing.",
    icon: Brain,
  },
  {
    title: "Hybrid Search",
    description: "Full-text поиск вместе с pgvector retrieval и пользовательскими фильтрами.",
    icon: Radar,
  },
  {
    title: "Offline Sync",
    description: "IndexedDB, sync_queue и Supabase Channels для работы без разрыва контекста.",
    icon: WifiOff,
  },
  {
    title: "BYOS Media",
    description: "Google Drive пользователя как хранилище медиа через Next.js proxy.",
    icon: Cloud,
  },
  {
    title: "Lock Center",
    description: "Zero-knowledge проверка, masked preview и блокировка export для protected notes.",
    icon: Lock,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-2xl shadow-violet-950/10 backdrop-blur md:p-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-accent">SmartNotes 2026</p>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
                Создал и забыл. Система сама напомнит, найдет и разложит.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/72">
                Каркас нового проекта собран под Next.js 16, React 19, TypeScript strict, Supabase pgvector, Zustand,
                TanStack Query, Tiptap, Yjs и BYOS-медиа.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-foreground p-5 text-background">
              <p className="text-sm uppercase tracking-[0.25em] text-background/60">Architecture</p>
              <p className="mt-3 text-2xl font-bold">Feature-Sliced Design</p>
              <p className="mt-3 text-sm leading-6 text-background/72">
                `/app`, `/features`, `/entities`, `/shared`, `/services` уже разведены по ответственности.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <article
                className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-lg shadow-violet-950/5 backdrop-blur"
                key={module.title}
              >
                <Icon aria-hidden className="mb-5 h-7 w-7 text-accent" />
                <h2 className="text-xl font-bold">{module.title}</h2>
                <p className="mt-3 leading-7 text-foreground/70">{module.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
