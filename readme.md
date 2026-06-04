# SmartNotes AI

> **"Создал и забыл"** — умная система заметок, которая сама помогает находить, ранжировать, перекладывать и актуализировать ваши записи.

**[🌐 Живое демо (Vercel)](https://smartnotes-ai-bay.vercel.app/)** | **[⚙️ ИИ-Бэкенд (Railway)](https://smartnotes-ai-production-7c69.up.railway.app)**

SmartNotes AI — это PWA-приложение для заметок нового поколения. Оно объединяет в себе совместное редактирование в реальном времени, встроенный AI-движок для семантического поиска и автотегирования, а также бескомпромиссный подход к приватности (Zero-Knowledge) и хранению данных (Bring Your Own Storage).

---

## 🚀 Быстрый старт

### 1. Клонирование и установка

```bash
git clone <repo-url>
cd SmartNotes-ai
npm install
```

### 2. Настройка окружения

Скопируйте пример файла конфигурации:

```bash
cp .env.example .env
```

Вам потребуются:
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google OAuth**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (для BYOS и авторизации)
- **OpenRouter**: `OPENROUTER_API_KEY` (для AI-функций)

### 3. Запуск проекта

```bash
npm run dev
```

Данная команда запустит одновременно Next.js веб-приложение и Fastify ИИ-бэкенд:
- **Фронтенд (Next.js)** будет доступен по адресу `http://localhost:3000`.
- **ИИ-Бэкенд (Fastify)** запустится на порту `http://localhost:8081`.

---

## 📚 Документация проекта

Документация разделена на концептуальную (для понимания сути продукта) и детальную техническую (для разработчиков):

### Презентационные и продуктовые материалы
1. **[Продуктовая концепция и киллер-фичи](docs/1-pitch-and-product.md)** — Решаемая проблема, отличие от классических заметочников, концепции BYOS, Zero-Knowledge и AI.
2. **[Архитектура и технический стек](docs/2-architecture.md)** — Общий обзор архитектуры данных, интеграция Yjs, синхронизация через Supabase Channels и ИИ-маршрутизация.
3. **[Текущий статус и Roadmap](docs/3-current-status.md)** — Актуальный статус готовности проекта (что уже работает, а что находится в разработке).

### Глубокая техническая документация (Tech Docs)
Детальное описание внутренних механизмов и кода модулей находится в папке **[docs/tech/](docs/tech/)**:
- **[0-system-overview.md](docs/tech/0-system-overview.md)** — Монорепозиторная структура, FSD-архитектура, провайдеры хранения.
- **[1-ai-and-chat.md](docs/tech/1-ai-and-chat.md)** — Работа эндпоинтов `/analyze` и `/chat`, семантический поиск, RAG-контекст, 15+ экшенов агента.
- **[2-editor-and-crdt.md](docs/tech/2-editor-and-crdt.md)** — Интеграция Tiptap с Yjs (CRDT), работа WebSocket канала трансляции обновлений.
- **[3-byos-media.md](docs/tech/3-byos-media.md)** — Провайдеры медиа (IndexedDB / Google Drive) и фоновый воркер синхронизации при появлении сети.
- **[4-lock-center-and-security.md](docs/tech/4-lock-center-and-security.md)** — Алгоритм Zero-Knowledge, шифрование и timing-защищённое сравнение хешей (SHA-256).
- **[5-ui-and-animations.md](docs/tech/5-ui-and-animations.md)** — Стор Zustand, анимации Framer Motion, Drag-and-Drop и компенсация высоты виртуальной клавиатуры.

---

## 🛠 Технологический стек (Кратко)

- **Frontend/Backend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, React Query.
- **База данных и Auth:** Supabase (PostgreSQL + pgvector).
- **Совместное редактирование:** Tiptap + Yjs (CRDT) + Supabase Realtime.
- **AI-движок:** OpenRouter (LLM) + pgvector (Embeddings).
- **Хранение медиа:** Google Drive (концепция BYOS).

---

*Private project. All rights reserved.*
