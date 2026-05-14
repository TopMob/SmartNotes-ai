# SmartNotes AI

> **"Создал и забыл"** — умная система заметок, которая сама помогает находить, ранжировать, перекладывать и актуализировать ваши записи.

SmartNotes AI — это PWA-приложение для заметок с встроенным AI-движком, совместным редактированием (Yjs + Supabase Realtime), BYOS-медиа хранением (Google Drive), продвинутым поиском и zero-knowledge защитой контента.

---

## 🧩 Стек

| Категория | Технология |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (Strict Mode) |
| Database | Supabase (Postgres + pgvector) |
| Realtime | Supabase Channels + Yjs (CRDT) |
| State | Zustand + TanStack Query |
| UI | Tailwind CSS + shadcn/ui + Framer Motion |
| Editor | Tiptap + Canvas API |
| Media | Google Drive (BYOS) через Next.js Proxy |
| AI | OpenRouter (LLM) + pgvector (Embeddings) |
| Deployment | Vercel + PWA |

---

## 🚀 Quick Start

### 1. Клонирование и установка

```bash
git clone <repo-url>
cd SmartNotes-ai
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp .env.example .env
```

Обязательные переменные:
- `NEXT_PUBLIC_SUPABASE_URL` — URL Supabase проекта
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth Client ID
- `OPENROUTER_API_KEY` — OpenRouter API key для AI

> 📖 Полная документация по переменным: [`dock/environment.md`](dock/environment.md)

### 3. Настройка Supabase

Запустите SQL-схему в Supabase SQL Editor. Схема включает:
- `profiles` — профили пользователей с `plan` enum
- `notes` — заметки с lock-полями, AI-статусами, pgvector
- `note_pages` — многостраничные заметки
- `note_media` — медиа-дескрипторы (BYOS)
- `note_access` / `note_invites` — совместный доступ
- `note_effective_access` — view с автоматическими триггерами
- `note_embeddings` — pgvector embeddings
- `ai_jobs` — очередь AI-анализа
- `folders` — папки с `isHidden`, `folderOrder`
- `user_settings` — настройки с JSONB editor/interface
- `feedback` — отзывы пользователей

> 📖 Полная схема данных: [`dock/data-model.md`](dock/data-model.md)

### 4. Запуск

```bash
npm run dev
```

Приложение доступно на `http://localhost:3000`.

---

## 📁 Структура проекта

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── ai/             # AI analyze + chat endpoints
│   │   ├── health/         # Health check
│   │   ├── media/          # Google Drive upload proxy
│   │   └── supabase/       # Runtime config endpoint
│   ├── auth/               # Auth callback
│   ├── login/              # Login page
│   ├── settings/           # Settings page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Entry page
│   └── providers.tsx       # App providers (auth, query, etc.)
│
├── entities/               # Domain types & models
│   ├── note/               # Note, NotePage, NoteLock, MediaDescriptor
│   ├── folder/             # Folder, FolderDraft
│   ├── user/               # User, AccessRole, InviteStatus
│   ├── ai-metadata/        # AiMetadata, ResurfacingClass
│   └── settings/           # UserSettings, ThemePreset, EditorSettings
│
├── features/               # Feature modules (FSDDD)
│   ├── ai-engine/          # AI analysis pipeline, auto-analyze, AI store
│   ├── app-shell/          # Main UI shell, Header, Sidebar, NoteCard, etc.
│   ├── auth/               # Auth provider, login shell, Google One Tap
│   ├── bootstrap/          # Data bootstrap (runtime config)
│   ├── editor/             # Tiptap editor, math extension, DrawingCanvas
│   ├── editor-collab/      # Yjs + Supabase Realtime, IndexedDB persistence
│   ├── export-import/      # Export/Import/Print services
│   ├── feedback/           # Feedback modal + API
│   ├── folders/            # Folder CRUD, queries, mutations
│   ├── lock-center/        # Lock service (SHA-256), lock UI
│   ├── media-byos/         # BYOS media types
│   ├── notes/              # Note CRUD, queries, mutations, utils
│   ├── search/             # Search engine, search store, filters UI
│   └── settings/           # Settings CRUD, queries, mutations
│
├── services/               # Background services
│   ├── ai/                 # AI queue
│   ├── diagnostics/        # Runtime diagnostics
│   ├── notifications/      # Notification service
│   ├── realtime/           # Realtime subscriptions
│   ├── reminders/          # Reminder service
│   ├── sync/               # Sync queue + consumer
│   ├── console-log-store   # Diagnostic log store
│   └── event-bus           # Internal event system
│
├── shared/                 # Shared utilities
│   ├── api/                # Supabase client, OpenRouter client, Google Drive types
│   ├── lib/                # crypto, i18n, local-storage, search, utils
│   ├── store/              # Global UI store
│   ├── ui/                 # Base UI components (button, error-boundary, logo)
│   ├── utils/              # date, string helpers
│   └── lib/react-query/    # Query client + query keys
│
└── middleware.ts           # Next.js middleware (auth redirect)
```

---

## 📖 Документация

| Документ | Описание |
|----------|----------|
| [`dock/functions.md`](dock/functions.md) | Полный функциональный объём продукта — что должно быть реализовано |
| [`dock/architecture.md`](dock/architecture.md) | Архитектура, ключевые системы, принципы проектирования |
| [`dock/api-reference.md`](dock/api-reference.md) | API endpoints, контракты, авторизация |
| [`dock/data-model.md`](dock/data-model.md) | Схема базы данных, таблицы, поля, связи |
| [`dock/environment.md`](dock/environment.md) | Переменные окружения, ключи, конфигурация |
| [`dock/implementation-status.md`](dock/implementation-status.md) | Текущий статус реализации по модулям |

---

## 🔑 Ключевые системы

### AI Engine
AI работает как pipeline: после изменения заметки она получает `aiStatus = pending` и ставится в очередь. Pipeline генерирует `userTags`, `hiddenTags`, предлагает `folderId`, считает `relevance`, назначает `resurfacingClass`. Поиск должен быть гибридным: full-text + semantic/vector.

### Editor + Collab
Tiptap-редактор с Yjs CRDT для совместного редактирования. Supabase Realtime transport + IndexedDB persistence. Durable save с debounce и fallback на LocalStorage.

### BYOS Media
Пользовательские файлы хранятся на Google Drive пользователя. В заметках — только ссылочные `MediaDescriptor`. Upload через Next.js proxy. Client-side сжатие до 1920px JPEG 0.8.

### Lock Center
Zero-knowledge защита: SHA-256 хэш пароля на клиенте, маскирование контента, запрет экспорта/печати для locked notes.

### Search Engine
Нормализация токенов, fuzzy matching, транслитерация RU→EN, синонимическое расширение, взвешивание полей. Гибридный поиск: full-text + vector retrieval.

---

## 🛠 Команды

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

---

## 📊 Прогресс реализации

| Модуль | Прогресс |
|--------|----------|
| AUTH & SESSION | 75% |
| NOTES CORE | 85% |
| EDITOR | 75% |
| COLLAB/SAVE | 75% |
| FOLDERS | 65% |
| SEARCH & FILTERS | 55% |
| AI ENGINE | 55% |
| AI CHAT PANEL | 50% |
| COMMAND PALETTE | 80% |
| MEDIA (BYOS) | 40% |
| LOCK CENTER | 75% |
| EXPORT/IMPORT | 35% |
| THEMING & SETTINGS | 40% |
| PWA & SYSTEM | 40% |
| OFFLINE/SYNC | 50% |

> 📖 Детальный статус по каждой функции: [`dock/implementation-status.md`](dock/implementation-status.md)

---

## 🏗 Принципы разработки

1. **Функция важнее реализации** — при конфликте старой механики с новым стеком сохраняется функция, а не старый код
2. **Offline-first** — IndexedDB fallback, sync_queue для изменений без сети
3. **Partial updates** — фронтенд отправляет только дельту измененных полей
4. **AI как pipeline** — semantic/vector subsystem для classification, retrieval, resurfacing
5. **BYOS** — медиа хранятся у пользователя, заметки содержат только ссылочные представления
6. **Zero-knowledge** — проверка пароля на клиенте, контент маскируется до unlock
7. **PWA обязателен** — installable app, offline shell, системные уведомления

---

## 📄 Лицензия

Private project. All rights reserved.