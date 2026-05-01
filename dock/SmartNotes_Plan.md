# SmartNotes AI — План реализации

> Анализ на основе `SmartNotes_Structure.txt`, `SmartNotes_Features.txt` и текущего кода в `/src`.

---

## 🗂 Легенда статусов

| Статус | Значение |
|--------|----------|
| ✅ **Готово** | Реализовано, файлы существуют |
| 🔶 **Скелет** | Папка/файл есть, но логика пустая или минимальная |
| ❌ **Не начато** | Полностью отсутствует |
| 💡 **Новая идея** | Не было в спеке, добавлено как предложение |

---

## 1. AUTH & SESSION

| Задача | Статус | Примечание |
|--------|--------|------------|
| Google OAuth / One Tap | ✅ | `login-shell.tsx` — реализовано |
| Email + пароль вход/регистрация | ✅ | Есть в `login-shell.tsx` |
| Reset password flow | ✅ | В `login-shell.tsx` |
| Popup → redirect fallback | ✅ | Реализован |
| Безопасный logout | ✅ | В auth hooks |
| Изменение display name | 🔶 | Модель есть (`profiles`), UI — не найдено |
| Загрузка/обновление аватара | 🔶 | Поле `avatar_url` в БД, UI — отсутствует |
| Копирование UID | ❌ | Не реализовано |
| Таймауты auth-операций | 🔶 | Частично через watchdog |
| Bootstrap config endpoint | ✅ | `data-bootstrap.tsx` |
| Degraded auth mode | 🔶 | Скелет в shell |
| Cooldown повторного Google prompt | ❌ | Не найдено |

---

## 2. NOTES CORE

| Задача | Статус | Примечание |
|--------|--------|------------|
| CRUD заметок | ✅ | `notes-repository.ts`, `use-note-mutations.ts` |
| Корзина / восстановление / удаление | ✅ | Мутации реализованы |
| Многостраничная заметка | 🔶 | `note_pages` в БД, UI управления страницами — не найдено |
| Перелистывание / добавление / удаление страниц | 🔶 | Логика в мутациях, UI — не найдено |
| Модальное окно управления страницами | ❌ | Отсутствует |
| Отдельные заголовки страниц | 🔶 | Поле в БД, UI — нет |
| Постраничные рисунки | 🔶 | `drawing_data_url` в БД, Canvas UI — нет |
| Pin / Favorite / Archive | ✅ | В мутациях |
| Напоминания | ✅ | `reminder-service.ts`, `reminder_at` в БД |
| Автогенерация заголовка | ✅ | Триггер в БД (из `content`) |
| Пагинация заметок | ✅ | `use-notes-query.ts` |
| Сохранение scroll position | ❌ | Не реализовано |
| Сортировка: pinned отдельно | 🔶 | Индексы есть, логика UI — проверить |

---

## 3. EDITOR

| Задача | Статус | Примечание |
|--------|--------|------------|
| Tiptap редактор | 🔶 | `editor-types.ts` — только модель, сам редактор не найден |
| Toolbar (bold/italic/underline/strike) | ❌ | Нет компонента редактора |
| Структурные блоки (lists, hr) | ❌ | Нет |
| Выравнивание текста и медиа | ❌ | Нет |
| Undo / Redo | ❌ | Нет |
| Внутренние ссылки на заметки | ❌ | Нет |
| Escape → тихое сохранение | ❌ | Нет |
| Inline теги в редакторе | ❌ | Нет |
| Math Resolver | ❌ | Нет |
| Paste sanitization (Word/HTML) | ❌ | Нет |
| Canvas рисунки | ❌ | Нет |
| Feature flags для editor tools | 🔶 | `editor` jsonb в `user_settings`, UI нет |
| Модульные плагины | ❌ | Нет |

> ⚠️ **Editor — самый незакрытый блок.** Вся папка `/features/editor` содержит только `editor-types.ts`.

---

## 4. FOLDERS

| Задача | Статус | Примечание |
|--------|--------|------------|
| CRUD папок | ✅ | `folders-repository.ts` |
| Hidden folders | ✅ | `is_hidden` в БД, API |
| Ручная сортировка / DnD | 🔶 | `folder_order` в БД, DnD UI — не найдено |
| Folder overview grid | ❌ | Нет UI |
| Context menu папки | 🔶 | Частично в `BottomSheet.tsx` |
| Folder limit UI | ❌ | Нет |
| Unhide папки | 🔶 | API есть, отдельный экран — нет |
| Preview описания (развернуть/свернуть) | ❌ | Нет |
| Корзина папок (restore/permanent delete) | 🔶 | `trashed_at` в БД, UI — нет |

---

## 5. SEARCH & FILTERS

| Задача | Статус | Примечание |
|--------|--------|------------|
| Глобальный текстовый поиск | ✅ | `search.ts`, `search_vector` в БД |
| Нормализация (ё→е, раскладка, стемминг) | ✅ | `search.ts` — расширенная логика |
| Fuzzy matching | ✅ | В `search.ts` |
| Фильтр по папкам / тегам / периоду | 🔶 | Частично в `TopFiltersPopup.tsx` |
| Сохранённые пресеты фильтров | ❌ | Нет UI, нет хранилища |
| Сортировка по relevance / алфавиту / длине | 🔶 | Частично |
| Ручная сортировка заметок + undo | ❌ | `orderHistory` нет в store |
| Hybrid search (full-text + vector) | 🔶 | `note_embeddings` в БД, API поиска — только full-text |
| Автоподсказка тегов | ❌ | Нет |

---

## 6. AI ENGINE

| Задача | Статус | Примечание |
|--------|--------|------------|
| Analyze pipeline (анализ заметки) | ✅ | `analyze-note.ts`, `/api/ai/analyze/route.ts` |
| AI статусы (pending/analyzing/done/error) | ✅ | Enum в БД, `ai_jobs` |
| Генерация `userTags` / `hiddenTags` | ✅ | В `analyze-note.ts` |
| Выбор `folderId` (AI suggestion) | 🔶 | Логика есть, feedback loop — нет |
| Расчёт `relevance` | ✅ | Поле в БД |
| `resurfacingClass` | 🔶 | Enum в БД, UI — нет |
| Prompt versioning | 🔶 | Поле в `ai_jobs` |
| Batch reindex | 🔶 | `ai-queue.ts` — скелет |
| Embeddings / Vector search | 🔶 | `note_embeddings` + HNSW index, пайплайн — нет |
| Vision pipeline (canvas → текст) | ❌ | Нет |
| Feedback loop (перемещение = сигнал) | ❌ | Нет |
| UI badges статуса анализа | ❌ | Нет в `NoteCard.tsx` |
| Кнопка ручного повторного анализа | ❌ | Нет |
| Chunking + нормализация для retrieval | ❌ | Нет |
| **🤖 AI Chat Panel (гид по заметкам)** | 🔶 | `AiChatPanel.tsx` + `/api/ai/chat/route.ts` — **есть скелет!** |

---

## 7. 🤖 AI CHAT PANEL — Подробный план

> Инспирация: Gmail AI (Gemini), справа открывается панель, можно спрашивать про содержимое.

### Что уже есть
- `src/features/ai-engine/ui/AiChatPanel.tsx` — компонент (~10KB)
- `src/app/api/ai/chat/route.ts` — API route (~5KB)

### Что нужно реализовать / доделать

| Задача | Приоритет |
|--------|-----------|
| Скользящая панель справа (slide-in, как Gmail) | 🔴 Высокий |
| Кнопка открытия чата в Header / FAB | 🔴 Высокий |
| Стриминг ответа (SSE / chunked response) | 🔴 Высокий |
| RAG: поиск по заметкам через embeddings | 🔴 Высокий |
| Контекст: передача открытой заметки в промпт | 🔴 Высокий |
| История чата (в памяти сессии) | 🟡 Средний |
| Предложения вопросов (quick prompts) | 🟡 Средний |
| Ссылки на заметки в ответе (кликабельные) | 🟡 Средний |
| Режим "спросить про все заметки" | 🟡 Средний |
| Режим "спросить про текущую заметку" | 🟡 Средний |
| Markdown рендер ответа | 🟡 Средний |
| Кнопка "Вставить в заметку" | 🟢 Низкий |
| Персистентная история чата (опционально) | 🟢 Низкий |

---

## 8. MEDIA / BYOS

| Задача | Статус | Примечание |
|--------|--------|------------|
| Вставка изображений в заметку | ❌ | Нет UI |
| Google Drive proxy upload | 🔶 | `/api/media` существует, детали — нет |
| Client-side сжатие изображений | ✅ | `compress-image.ts` |
| Temporary preview URL | ❌ | Нет |
| Resize / drag handles для медиа | ❌ | Нет |
| Degraded режим без Google Drive | ❌ | Нет |
| IndexedDB thumbnails cache | ❌ | Нет |
| Token refresh Google Drive | ❌ | Нет |

---

## 9. SECURITY / LOCK CENTER

| Задача | Статус | Примечание |
|--------|--------|------------|
| Lock Center UI | ❌ | Папка `/lock-center/lib` — только `lock-service.ts` (скелет) |
| Пароль на заметку + SHA-256 | 🔶 | `lock-service.ts`, поля в БД |
| Маскирование контента заблокированной заметки | ❌ | Нет |
| Unlock flow / Remove lock | ❌ | Нет UI |
| Запрет экспорта/печати locked notes | ❌ | Нет |
| Anti-autofill policy | ❌ | Нет |

---

## 10. COLLABORATION / SHARING

| Задача | Статус | Примечание |
|--------|--------|------------|
| Шаринг заметок / папок | ❌ | Схема БД есть, UI нет |
| Инвайты по email/UID | ❌ | `note_invites` в БД, API нет |
| Роли owner/editor/viewer | ✅ | В БД |
| Accept/Reject invite | ❌ | Нет |
| Collaborator chips / badges | ❌ | Нет |
| Управление доступами | ❌ | Нет |
| Realtime sync между пользователями | 🔶 | `realtime-subscriptions.ts` — скелет |

---

## 11. EXPORT / IMPORT / PRINT

| Задача | Статус | Примечание |
|--------|--------|------------|
| Экспорт заметки в JSON / TXT | 🔶 | `note-utils.ts` — частично |
| Импорт JSON bundle | 🔶 | `note-import.ts` — есть |
| Массовый экспорт / по папке | ❌ | Нет UI |
| PDF через print flow | ❌ | Нет |
| Версионирование bundle | ❌ | Нет |
| Запрет экспорта locked notes | ❌ | Нет |

---

## 12. THEMING & SETTINGS

| Задача | Статус | Примечание |
|--------|--------|------------|
| Базовые theme presets | 🔶 | Enum в БД (paper, cyber, etc.), UI — не найдено |
| Кастомные presets | 🔶 | `custom_presets` jsonb в БД |
| Токенизированная тема | ❌ | Нет CSS-токенов в `globals.css` (минимально) |
| Background image (URL / файл) | ❌ | Поля в БД, UI — нет |
| UI opacity / Cards opacity | ❌ | Поля в БД, применение — нет |
| Язык RU / EN | ✅ | `i18n.ts` — полноценный |
| Reduce motion | 🔶 | Поле в БД |
| Settings page с навигацией | 🔶 | `/app/settings` папка существует |
| Cloud/local merge settings | ❌ | Нет |
| Reset custom presets | ❌ | Нет |

---

## 13. PWA & SYSTEM

| Задача | Статус | Примечание |
|--------|--------|------------|
| PWA manifest | ✅ | `manifest.ts` |
| Service Worker | ❌ | `pwa-register.tsx` есть, SW — нет |
| Offline shell | ❌ | Нет |
| Browser notifications | 🔶 | `notification-service.ts` — скелет |
| Reminder scheduler | ✅ | `reminder-service.ts` |
| Splash + watchdog (~8s) | 🔶 | Частично в bootstrap |
| ConsoleLogStore | ✅ | `console-log-store.ts` |
| Feedback modal + рейтинг | ❌ | `feedback` в БД, UI нет |

---

## 14. OFFLINE / SYNC

| Задача | Статус | Примечание |
|--------|--------|------------|
| Offline-first IndexedDB | 🔶 | `local-notes-repository.ts`, `local-folders-repository.ts` |
| sync_queue | ✅ | `sync-queue.ts`, `sync-consumer.ts` |
| Realtime между устройствами | 🔶 | `realtime-subscriptions.ts` — скелет |
| SafeStorage fallback | ❌ | Нет |
| Quota error handling | ❌ | Нет |
| TTL для pending saves | ❌ | Нет |

---

## 15. 💡 НОВЫЕ ИДЕИ (не было в спеке)

| Идея | Описание | Приоритет |
|------|----------|-----------|
| **AI Daily Digest** | Утренний summary: "У тебя 3 задачи на сегодня, 2 идеи из прошлой недели стоит пересмотреть" | 🟡 |
| **Smart Resurfacing** | Карточка в топе "Вы писали это 30 дней назад — актуально?" с возможностью подтвердить/архивировать | 🔴 |
| **Note Connections / Graph View** | Граф связанных заметок через semantic similarity (как Obsidian Canvas) | 🟡 |
| **AI Auto-Summary в карточке** | Одна строка AI-summary прямо на карточке заметки | 🟡 |
| **Voice-to-Note** | Запись голоса → транскрипция → заметка через Whisper API | 🟢 |
| **Mood / Energy tracker** | Быстрый emoji-тег настроения при создании заметки, аналитика по времени | 🟢 |
| **Template Library** | Шаблоны заметок: Meeting Notes, Daily Journal, Project Brief — открываются одним кликом | 🟡 |
| **Smart Tags Merge** | AI предлагает объединить похожие теги ("работа" + "рабочее" → "работа") | 🟢 |
| **Focus Mode** | Полноэкранный редактор без отвлечений, zen-режим с плавным fade sidebar | 🟡 |
| **Быстрый захват (Quick Capture)** | Глобальный хоткей/FAB → открывается минимальное поле ввода, сохраняет заметку без открытия редактора | 🔴 |
| **AI Completion в редакторе** | `Tab` → AI допишет текущую мысль (как Notion AI / GitHub Copilot) | 🟡 |
| **Поиск по рисункам (OCR)** | Vision pipeline для canvas → текстовый индекс → попадает в поиск | 🟡 |
| **Note Health Score** | AI ставит "здоровье" заметки: актуальность, полнота, дата последнего просмотра | 🟢 |

---

## 📊 Общая картина прогресса

```
AUTH            ████████░░  75%  (UI профиля не закончен)
NOTES CORE      ██████░░░░  55%  (страницы, рисунки, scroll)
EDITOR          ██░░░░░░░░  15%  (только типы, Tiptap не подключен)
FOLDERS         ███████░░░  65%  (DnD, корзина, grid нет)
SEARCH          ██████░░░░  55%  (hybrid search, пресеты нет)
AI ENGINE       ██████░░░░  55%  (pipeline есть, embeddings/RAG нет)
AI CHAT PANEL   ███░░░░░░░  30%  (скелет есть, RAG/stream нет)
MEDIA BYOS      ███░░░░░░░  25%  (только compress-image)
LOCK CENTER     ██░░░░░░░░  15%  (только lib скелет)
COLLABORATION   ██░░░░░░░░  20%  (только БД схема)
EXPORT/IMPORT   ████░░░░░░  35%  (import есть, export UI нет)
THEMING         ████░░░░░░  35%  (i18n отличный, темы нет)
PWA/SYSTEM      ████░░░░░░  40%  (manifest, но SW нет)
OFFLINE/SYNC    █████░░░░░  45%  (queue есть, SafeStorage нет)
```

---

## 🚀 Рекомендуемый порядок реализации

### Фаза 1 — Рабочий продукт (MVP)
1. **Editor** — подключить Tiptap, toolbar, autosave
2. **Note Pages UI** — страницы, перелистывание, page manager modal
3. **AI Chat Panel** — RAG + streaming, slide-in панель
4. **Settings UI** — тема, язык, opacity

### Фаза 2 — Полнота
5. **Lock Center UI** — пароль, unlock, маскировка
6. **Theming** — CSS-токены, presets, background
7. **Canvas Drawing** — overlay, pen/eraser, undo
8. **Folders** — DnD, grid view, корзина UI
9. **Export** — JSON/TXT/PDF UI

### Фаза 3 — Рост
10. **Collaboration** — шаринг, инвайты, realtime
11. **Embeddings pipeline** — chunking, vector search
12. **Smart Resurfacing** — daily digest, connections graph
13. **PWA** — Service Worker, offline shell
14. **Quick Capture** — FAB, global hotkey
