# Технический аудит: загрузка в РФ + критические места

**Дата:** 2026-06-19
**Объём:** `SmartNotes-web` (Next.js 16, App Router) + инфраструктура (Vercel / Supabase / Railway / Google).
**Контекст:** учебный проект, хостинг остаётся на `*.vercel.app` (свой домен не покупаем). Цель — чтобы сайт корректно грузился в РФ и не «висел», и закрыть критические места **в коде**.

> Связанные документы: `TECHNICAL_AUDIT_REPORT.md` (долги AI-агента/RAG), `TECHNICAL_DEBT.md` (продуктовые TODO). Здесь — про доступность из РФ и критический путь загрузки. Устаревший `SECURITY_AUDIT_REPORT.xml` удалён: его «критические» уязвимости (auth-bypass, незащищённые `/api/ai/actions` и `/api/admin/feedback`) на момент аудита **уже закрыты** в коде (`executeAgentActions` → `createAuthenticatedServerSupabase()`, `admin/feedback` → `requireServerAuthorization()`), а его полезная идея BFF-прокси реализована (см. ниже).

---

## TL;DR

Главная причина «не грузится в РФ» — приложение из браузера ходило **напрямую** в `*.supabase.co` (AWS/Cloudflare), который в РФ режется DPI (ТСПУ). Запрос висел до таймаута → белый экран. Исправлено двумя независимыми мерами:

1. **BFF reverse-proxy**: трафик к Supabase (REST/Auth/Storage) идёт через свой же origin (`/-/supabase/*`), т.е. браузер делает same-origin запрос, а до Supabase ходит уже сервер Vercel (server-to-server, DPI не мешает).
2. **Видимое состояние вместо зависания**: пока идёт бутстрап — брендированный сплэш; при недоступности бэкенда за ~4 c — переход в офлайн-режим с понятным баннером «Нет связи» и кнопкой «Повторить», а не пустой экран на 8 секунд.

---

## A. Что реализовано (в этом проходе)

### A1. 🟢 BFF-прокси для Supabase — обход DPI без своего домена
* **Файлы:** `next.config.ts` (`rewrites()` → `/-/supabase/:path*` ⇒ `${SUPABASE_ORIGIN}/:path*`), `src/shared/api/supabase/client.ts` (браузерный клиент через `global.fetch` переписывает прямые вызовы `*.supabase.co` на same-origin `/-/supabase/...`).
* **Почему работает без домена:** если страница вообще открылась — значит origin (`*.vercel.app`) у этого пользователя доступен; тогда и данные пойдут через тот же доступный origin. Сервер Vercel → Supabase не подвержен клиентскому DPI.
* **Realtime (WebSocket) не проксируется** намеренно — остаётся прямым и просто деградирует, если недоступен (коллаборация — вторичная фича и не блокирует загрузку).
* **Требование к деплою:** на сборке должна быть переменная `NEXT_PUBLIC_SUPABASE_URL` (или `NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL`) — иначе rewrite не создаётся и клиент ходит напрямую (как раньше). На Vercel переменная задаётся в Project Settings.

### A2. 🟢 Сплэш + видимый офлайн-баннер вместо белого экрана
* **Файлы:** `src/features/auth/ui/boot-screen.tsx` (новый — `BootSplash` + `ConnectionBanner`, ru/en), `src/features/auth/ui/auth-provider.tsx` (рендерит сплэш вместо `return null`; ставит `offline:true` при сбое/таймауте; показывает баннер), `auth-store.ts` / `types.ts` (флаг `offline`).
* **Watchdog:** 8 c → **4 c**. Теперь при глухой сети пользователь за 4 c получает рабочий офлайн-UI (локальные заметки), а не ждёт 8 c в пустоту.
* **UX:** сплэш через 2.5 c показывает подсказку «Проверяем соединение…»; офлайн-баннер объясняет про возможные ограничения провайдера и предлагает VPN + «Повторить».

### A3. 🟢 Google Identity Services грузится лениво
* **Файл:** `src/app/layout.tsx` — убраны глобальные `<link preconnect accounts.google.com>` и `<Script gsi/client>` из `<head>` (грузились на каждой странице для всех, в т.ч. авторизованных).
* GSI теперь подгружается только когда реально нужен — лениво в `src/features/auth/lib/google-one-tap.ts` (логика уже была, убрано дублирование). Меньше зависимости от Google при обычной навигации.

### A4. 🟢 Хардненинг локальных эмбеддингов
* **Файл:** `src/shared/lib/ai/local-embeddings.ts` — добавлен `import "server-only"` (защёлка: модуль с service-role-ключом не сможет случайно попасть в клиентский бандл, сборка упадёт вместо тихой утечки); `env.cacheDir` переведён с `./.next/cache` на `os.tmpdir()` (на serverless FS только для чтения, кроме temp).

### A5. ✅ Шрифты — не трогали (это не проблема РФ)
* `next/font/google` (Geist, `layout.tsx`) **self-host'ит** шрифты на сборке; в рантайме обращений к Google Fonts нет. Менять не нужно.

---

## B. Что осталось — требует вашего решения (не правил, чтобы не сломать)

### B1. 🟠 `/api/admin/feedback`: проверка только «залогинен», а не «админ»
* `requireServerAuthorization()` (`shared/api/supabase/auth-guard.ts`) проверяет лишь наличие пользователя. Значит список отзывов может прочитать **любой авторизованный** пользователь, а не только админ. Список админов сейчас захардкожен и **клиентский** (`features/auth/lib/admin-acl.ts`, email `shazak6430@gmail.com`) — это UI-гейт, не защита.
* **Фикс:** на сервере сверять `user.email`/`user.id` с серверным allowlist (env `ADMIN_EMAILS`) или с ролью в Supabase (custom claim / таблица `profiles.role`). Клиентский `admin-acl.ts` оставить только для показа UI.

### B2. 🟡 Prompt injection через содержимое заметок
* `app/api/ai/chat/route.ts` и `backend/src/routes/chat.ts` интерполируют текст заметок в системный промпт. Расшаренная заметка может содержать инъекцию. Подробно описано в `TECHNICAL_AUDIT_REPORT.md` (1.2) — фикс: строгие разделители/нативные message-роли.

### B3. 🟡 SSRF-валидация Google Drive `fileId`
* `app/api/media/google-drive/download/route.ts` и `upload` подставляют `fileId` в URL `googleapis.com/drive/v3/files/${fileId}`. Проверить, что `fileId` валидируется по формату Drive ID (`^[a-zA-Z0-9_-]+$`) перед запросом.

### B4. 🟡 Альтернативный вход помимо Google
* Единственный вход — Google OAuth/One Tap (`accounts.google.com`), в РФ нестабилен. Стоит добавить вход по email (magic-link/OTP через Supabase Auth), не зависящий от Google. Не реализовано: требует включения Email-провайдера и SMTP в Supabase (деплой-решение).

### B5. 🟡 Realtime-коллаборация в РФ
* WebSocket к `*.supabase.co` напрямую — в РФ может не подниматься (через прокси Vercel WS не гоняем). Сейчас деградирует молча. Если коллаборация важна — рассмотреть собственный WS-релей; для учебного проекта достаточно текущей деградации.

---

## C. Прочие критические/качественные места (вне РФ)

* **C1 🟠 Единая точка отказа рендера** — `AuthProvider` раньше отдавал `null`; теперь сплэш + гарантированный `setReady(true)` во всех ветках (включая watchdog/`catch`). ОК.
* **C2 🟡 Service Worker** (`public/sw.js`) — `CACHE_NAME="smartnotes-v1"` захардкожен; app-код не залипает (`/_next/` и навигации идут в сеть), кэшируются только иконки/манифест. При желании версионировать `CACHE_NAME` из билд-хэша.
* **C3 🟡 `window.alert/confirm`** и нативные диалоги — см. `TECHNICAL_AUDIT_REPORT.md` (3.1); заменить на тосты/модалки.
* **C4 🟡 `useNotesFlat` без `useMemo`** (`features/notes/hooks/use-notes-query.ts`) — `flatMap` на каждый рендер; обернуть в `useMemo` при больших объёмах.
* **C5 🟡 `next/image`** — `images.remotePatterns` (`next.config.ts`) разрешает только `lh3.googleusercontent.com` и `drive.google.com`; при миграции `<img>`→`next/image` для других хостов добавить паттерны.

---

## D. Проверка перед деплоем (чек-лист)
1. На Vercel заданы `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (иначе BFF-прокси не активируется).
2. `ALLOWED_ORIGINS` в проде включает реальный URL (`https://smartnotes-ai-bay.vercel.app`), а не только localhost.
3. После деплоя в РФ-сети: страница открывается → видно сплэш → грузятся заметки (через `/-/supabase/...`, видно в Network). При отсутствии сети — баннер «Нет связи».

---

## Источники (доступность в РФ, проверено 2026-06-19)
- [Реестр РКН: пример блокировки поддомена *.vercel.app (ФНС, 18.06.2025)](https://rknweb.ru/blocked/1373322/)
- [Реестр РКН: meduza-lite.vercel.app — блокировка по IP 76.76.21.x (коллатераль по инфраструктуре)](https://rknweb.ru/blocked/363686/)
- [Habr QnA: *.vercel.app не открывается с мобильного интернета РФ без VPN](https://qna.habr.com/q/1405648)
- [Habr: Supabase из РФ без VPN не работает; варианты — self-host или прокси не в РФ](https://habr.com/ru/articles/904840/comments/)
