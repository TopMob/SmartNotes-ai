# SmartNotes AI

PWA для заметок с совместным редактированием, AI-функциями и подключаемым хранилищем.

**Демо:** [smartnotes-ai-bay.vercel.app](https://smartnotes-ai-bay.vercel.app/)

Проект публичен для демонстрации и находится в разработке. Возможности, API и схема хранения могут изменяться.

## Возможности

- совместное редактирование на базе Yjs и Supabase Realtime;
- AI-анализ заметок, чат и семантический поиск;
- Tiptap-редактор;
- локальное и подключаемое хранение медиа;
- авторизация и настройки приватности.

## Быстрый старт

```bash
git clone https://github.com/TopMob/SmartNotes-ai.git
cd SmartNotes-ai
npm install
npm run dev
```

Создайте файл `.env` вручную. Переменные окружения зависят от включённых функций:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`;
- Google OAuth: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`;
- AI-провайдер: `OPENROUTER_API_KEY`.

Команда `npm run dev` запускает веб-приложение и AI-бэкенд. Подробности находятся в документации проекта.

## Документация

- [Концепция и продукт](docs/1-pitch-and-product.md)
- [Архитектура](docs/2-architecture.md)
- [Текущий статус](docs/3-current-status.md)
- [Техническая документация](docs/tech/)

## Стек

Next.js, TypeScript, Tailwind CSS, Supabase, Tiptap, Yjs, Zustand, OpenRouter.

## Лицензия

Проект распространяется без заявленной open-source лицензии.
