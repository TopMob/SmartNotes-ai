# SmartNotes AI — Актуальный план реализации

> Обновлено: 2026-05-02. Анализ кода + исправление критических багов.

---

## 🗂 Легенда статусов

| Статус | Значение |
|--------|----------|
| ✅ **Готово** | Реализовано, работает |
| 🔶 **Скелет** | Файл/логика есть, но неполная |
| ❌ **Не начато** | Полностью отсутствует |
| 🐛 **Баг / исправлен** | Была ошибка, исправлена в этой сессии |
| 💡 **Новая идея** | Предложение |

---

## 🐛 Исправленные баги (текущая сессия)

| Файл | Баг | Статус |
|------|-----|--------|
| `bind-yjs-supabase-channel.ts` | `channel.send()` вызывался до SUBSCRIBED → Realtime падал на REST → `POST /rest/v1/notes?select=* 403` | ✅ Исправлен: буферизация до SUBSCRIBED |
| `use-durable-note-save.ts` | `scheduleSave()` вызывался **после** `return` (мёртвый код) — сохранение не работало | ✅ Исправлен: перемещён до return |
| `use-note-mutations.ts` (create) | При ошибке создания заметки `invalidateQueries` удалял оптимистичную заметку → редактор закрывался | ✅ Исправлен: оптимистичная заметка сохраняется при ошибке |

### Причинно-следственная цепочка бага «редактор закрывается»:
```
createNoteDraft()
  → optimisticNote добавлен в кэш
  → editor открыт (currentNoteId = note.id)
  → notesRepository.create() → POST /rest/v1/notes?select=* → 403
    (Supabase Realtime channel.send() REST fallback — ещё до SUBSCRIBED)
  → onError: invalidateQueries → кэш сброшен → optimisticNote исчез
  → currentNote = null → editorOpen && !currentNote → editor не рендерится
  → редактор закрыт
```

---

## 1. AUTH & SESSION

| Задача | Статус | Примечание |
|--------|--------|------------|
| Google OAuth / One Tap | ✅ | `login-shell.tsx` |
| Email + пароль вход/регистрация | ✅ | `login-shell.tsx` |
| Reset password flow | ✅ | `login-shell.tsx` |
| Popup → redirect fallback | ✅ | Реализован |
| Безопасный logout | ✅ | В auth hooks |
| Изменение display name | 🔶 | `profiles` в БД, UI нет |
| Загрузка/обновление аватара | 🔶 | `avatar_url` в БД, UI нет |
| Bootstrap config endpoint | ✅ | `data-bootstrap.tsx` |
| Degraded auth mode | 🔶 | Скелет в shell |
| Cooldown повторного Google prompt | ❌ | |
| Копирование UID | ❌ | |

---

## 2. NOTES CORE

| Задача | Статус | Примечание |
|--------|--------|------------|
| CRUD заметок | ✅ | `notes-repository.ts`, `use-note-mutations.ts` |
| Корзина / восстановление / удаление | ✅ | Мутации реализованы |
| Многостраничная заметка | ✅ | `note_pages` в схеме, `buildPageAddPatch` |
| Перелистывание страниц | ✅ | `EditorOverlay.tsx` — Prev/Next |
| Добавление страницы | ✅ | `addPage()` в toolbar |
| Удаление страниц | 🔶 | `buildPageDeletePatch` есть, UI кнопки нет |
| Pin / Favorite / Archive | ✅ | |
| Напоминания | ✅ | `reminder-service.ts` |
| Автогенерация заголовка | ✅ | Trigger БД + `deriveTitle` |
| Пагинация заметок | ✅ | `use-notes-query.ts` |
| Медиа: inline изображения | ✅ | `handleAttachImage` в EditorOverlay |
| Чтение `note_pages` из БД | ❌ | `mapNoteRow` возвращает `pages: []` |
| Сохранение scroll position | ❌ | |

---

## 3. EDITOR

| Задача | Статус | Примечание |
|--------|--------|------------|
| Tiptap редактор | ✅ | `EditorOverlay.tsx` |
| Toolbar (bold/italic/strike) | ✅ | |
| Underline | ⚠️ | Кнопка есть, extension не добавлен! |
| Структурные блоки (lists, hr) | ✅ | |
| Выравнивание текста | ✅ | TextAlign extension |
| Undo / Redo | ✅ | |
| Ссылки | ✅ | LinkExtension |
| Escape → закрыть | ✅ | |
| Вставка изображений | ✅ | |
| Auto-title из content | ✅ | debounce 3s |
| Теги footer input | 🔶 | Inline теги нет |
| Canvas рисунки | 🔶 | Создаёт Sketch страницу, canvas UI нет |
| Autosave / durable save | 🐛✅ | Баг исправлен |
| Math Resolver | ❌ | |
| Paste sanitization | ❌ | |
| AI Completion (Tab) | ❌ | |
| Feature flags editor | 🔶 | `user_settings.editor` jsonb |

---

## 4. COLLAB SESSION (YJS + Supabase Realtime)

| Задача | Статус | Примечание |
|--------|--------|------------|
| YJS Document | ✅ | |
| IndexedDB persistence | ✅ | `y-indexeddb` |
| Supabase Realtime transport | 🐛✅ | Баг исправлен: буферизация до SUBSCRIBED |
| Durable save debounce | 🐛✅ | Баг исправлен: мёртвый scheduleSave() |
| LocalStorage backup | ✅ | |
| Hydration fallback (600ms) | ✅ | |

---

## 5. FOLDERS

| Задача | Статус | Примечание |
|--------|--------|------------|
| CRUD папок | ✅ | |
| Hidden folders | ✅ | |
| Ручная сортировка / DnD | 🔶 | Поле в БД, UI нет |
| Folder overview grid | ❌ | |
| Context menu | 🔶 | `BottomSheet` |
| Корзина папок UI | 🔶 | `trashed_at` есть |

---

## 6. SEARCH & FILTERS

| Задача | Статус | Примечание |
|--------|--------|------------|
| Глобальный поиск | ✅ | `search.ts` |
| Нормализация, fuzzy | ✅ | |
| Фильтры popup | 🔶 | `TopFiltersPopup.tsx` |
| Сохранённые фильтры | 🔶 | ui-store + UI |
| Hybrid search (vector) | ❌ | |
| Автоподсказка тегов | 🔶 | |

---

## 7. AI ENGINE

| Задача | Статус | Примечание |
|--------|--------|------------|
| Analyze pipeline | ✅ | |
| AI статусы | ✅ | |
| Генерация тегов | ✅ | |
| Batch reindex | 🔶 | |
| Embeddings / Vector search | 🔶 | Таблица есть, пайплайн нет |
| Vision pipeline | ❌ | |
| Feedback loop | ❌ | |
| UI badges | ❌ | |

---

## 8. 🤖 AI CHAT PANEL

| Задача | Статус | Примечание |
|--------|--------|------------|
| Slide-in панель | ✅ | `AiChatPanel.tsx` |
| Кнопка в Header | ✅ | |
| Стриминг ответа | 🔶 | |
| RAG (embeddings) | ❌ | Сейчас `listAll()` — без vector |
| Markdown рендер | 🔶 | |
| Ссылки на заметки | 🔶 | |
| Персистентная история | ❌ | |

---

## 9. COMMAND PALETTE

| Задача | Статус | Примечание |
|--------|--------|------------|
| Cmd+K Palette | ✅ | `CommandPalette.tsx` (новый) |
| Поиск заметок / действий | ✅ | |

---

## 10. MEDIA

| Задача | Статус | Примечание |
|--------|--------|------------|
| Inline изображения | ✅ | |
| Client-side сжатие | ✅ | `compress-image.ts` |
| Google Drive proxy | 🔶 | Скелет |
| Resize медиа | ❌ | |

---

## 11. LOCK CENTER

| Задача | Статус | Примечание |
|--------|--------|------------|
| Lock Center UI | ❌ | Только lib скелет |
| Пароль + SHA-256 | 🔶 | `lock-service.ts`, поля в БД |
| Unlock flow sheet | ❌ | `openSheet("lock")` есть, содержимое нет |
| Маскирование контента | ❌ | |

---

## 12. EXPORT / IMPORT

| Задача | Статус | Примечание |
|--------|--------|------------|
| Экспорт JSON/TXT | 🔶 | |
| Импорт JSON bundle | 🔶 | `note-import.ts` |
| Массовый экспорт | ❌ | |
| PDF | ❌ | |

---

## 13. THEMING & SETTINGS

| Задача | Статус | Примечание |
|--------|--------|------------|
| Theme presets (data-theme) | 🔶 | CSS применяется, UI нет |
| CSS-токены | 🔶 | `globals.css` частично |
| Background image | 🔶 | CSS vars есть, UI нет |
| Opacity settings | 🔶 | CSS vars есть, UI нет |
| Язык RU / EN | ✅ | |
| Settings page | 🔶 | `/app/settings` папка |

---

## 14. PWA & SYSTEM

| Задача | Статус | Примечание |
|--------|--------|------------|
| PWA manifest | ✅ | |
| Service Worker | ❌ | |
| Offline shell | ❌ | |
| Reminder scheduler | ✅ | |
| ConsoleLogStore | ✅ | |
| Feedback modal | ❌ | |

---

## 15. OFFLINE / SYNC

| Задача | Статус | Примечание |
|--------|--------|------------|
| IndexedDB offline | 🔶 | `local-notes-repository.ts` |
| sync_queue | ✅ | |
| Realtime | 🐛✅ | Баг исправлен |
| SafeStorage fallback | ❌ | |

---

## 📊 Прогресс

```
AUTH            ████████░░  75%
NOTES CORE      ████████░░  75%  ↑ (editor работает, inline media)
EDITOR          ███████░░░  65%  ↑ (Tiptap подключён, underline сломан)
COLLAB/SAVE     ████████░░  75%  ↑↑ (2 бага исправлены)
FOLDERS         ███████░░░  65%
SEARCH          ██████░░░░  55%
AI ENGINE       ██████░░░░  55%
AI CHAT PANEL   █████░░░░░  50%
COMMAND PALETTE ████████░░  80%  ↑ (новый компонент)
MEDIA           ████░░░░░░  40%
LOCK CENTER     ██░░░░░░░░  15%
EXPORT/IMPORT   ████░░░░░░  35%
THEMING         ████░░░░░░  40%
PWA/SYSTEM      ████░░░░░░  40%
OFFLINE/SYNC    █████░░░░░  50%
```

---

## 🚀 Рекомендуемый порядок

### 🔴 Прямо сейчас
1. Добавить `@tiptap/extension-underline` в `EditorOverlay.tsx`
2. **Запустить `dock/smartnotes_schema.sql`** в Supabase SQL Editor
3. Реализовать загрузку `note_pages` в `notes-repository.ts` (сейчас `pages: []`)

### Фаза 1 — Стабилизация
4. Lock Center UI — unlock sheet, password input
5. Settings page — темы, opacity, язык
6. Canvas sketch UI — базовый `<canvas>` для Sketch страниц

### Фаза 2 — Полнота
7. Embeddings pipeline → RAG в AI Chat
8. Folders DnD + grid view
9. Export UI (JSON/TXT/PDF)
10. Collaboration — шаринг, инвайты

### Фаза 3 — Рост
11. Smart Resurfacing + Daily Digest
12. Service Worker + offline shell
13. Voice-to-Note (Whisper API)
14. Note Connections / Graph View

---

## ⚠️ SQL: какую схему запускать

**Использовать: `dock/smartnotes_schema.sql`**

Код (`note-mappers.ts`, `notes-repository.ts`) написан под эту схему:
- Нормализованные таблицы: `note_pages`, `note_media`, `note_access`, `note_invites`, `note_embeddings`
- Lock-поля в `notes`: `lock_version`, `lock_hash`, `lock_salt`, `lock_hidden`
- `profiles` с `plan` enum (`free`, `pro`, `team`)
- `note_effective_access` с автоматическим обновлением через тригеры
- Расширение `vector` (для embeddings, можно пропустить если не нужно)

> `smartnotes_supabase_full.sql` — **устаревшая** альтернатива с jsonb колонками. Не использовать.
