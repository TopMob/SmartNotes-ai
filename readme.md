# SmartNotes AI

> **"Создал и забыл"** — умная система заметок, которая сама помогает находить, ранжировать, перекладывать и актуализировать ваши записи.

SmartNotes AI — PWA-приложение для заметок с встроенным AI-движком, совместным редактированием (Yjs + Supabase Realtime), BYOS-медиа хранением (Google Drive), продвинутым поиском и zero-knowledge защитой контента.

---

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | Next.js 16 (App Router) | SSR, routing, API routes, middleware |
| Language | TypeScript (Strict Mode) | Type-safe development |
| Database | Supabase (PostgreSQL + pgvector) | Primary data store, auth, realtime, embeddings |
| Realtime | Supabase Channels + Yjs (CRDT) | Collaborative editing, live sync |
| State | Zustand + TanStack React Query | Client state + server cache |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Styling, component library, animations |
| Editor | Tiptap + Canvas API | Rich-text editing, drawing overlay |
| Media | Google Drive (BYOS) via Next.js Proxy | User-owned file storage |
| AI | OpenRouter (LLM) + pgvector (Embeddings) | Note classification, chat, semantic search |
| Drag & Drop | @dnd-kit | Folder and note reordering |
| Virtualization | @tanstack/react-virtual | Long list performance |
| Offline | Yjs + IndexedDB (y-indexeddb) | Local persistence, offline-first |
| Deployment | Vercel + PWA | Hosting, installable app |
---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd SmartNotes-ai
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in the variables:

```bash
cp .env.example .env
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth Client ID
- `OPENROUTER_API_KEY` — OpenRouter API key for AI features

> 📖 Full environment variable reference: [`dock/environment.md`](dock/environment.md)

### 3. Supabase Setup

Run the SQL schema in Supabase SQL Editor. The schema includes tables for:
- `profiles` — user profiles with `plan` enum
- `notes` — notes with lock fields, AI statuses, pgvector
- `note_pages` — multi-page notes
- `note_media` — media descriptors (BYOS)
- `note_access` / `note_invites` — collaborative access
- `note_effective_access` — view with auto triggers
- `note_embeddings` — pgvector embeddings
- `ai_jobs` — AI analysis queue
- `folders` — folders with `isHidden`, `folderOrder`
- `user_settings` — settings with JSONB editor/interface
- `feedback` — user feedback

### 4. Run

```bash
npm run dev
```

App is available at `http://localhost:3000`.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── ai/             #   AI analyze + chat (nodejs runtime)
│   │   ├── health/         #   Health check
│   │   ├── media/          #   Google Drive upload proxy
│   │   └── supabase/       #   Runtime config endpoint
│   ├── auth/               #   Auth callback (OAuth code exchange)
│   ├── login/              #   Login page
│   ├── settings/           #   Settings page
│   ├── layout.tsx          #   Root layout
│   ├── page.tsx            #   Entry page → AppEntry
│   ├── providers.tsx       #   App-wide providers
│   └── pwa-register.tsx    #   PWA service worker registration
│
├── entities/               # Domain types & models (pure types, no logic)
│   ├── note/               #   Note, NotePage, NoteLock, MediaDescriptor, NoteAccess
│   ├── folder/             #   Folder, FolderDraft
│   ├── user/               #   User, AccessRole, InviteStatus
│   ├── ai-metadata/        #   AiMetadata, ResurfacingClass
│   └── settings/           #   UserSettings, ThemePreset, EditorSettings
│
├── features/               # Feature modules (FSDDD pattern)
│   ├── ai-engine/          #   AI analysis pipeline, auto-analyze, AI store
│   ├── app-shell/          #   Main UI shell, Header, Sidebar, NoteCard, CommandPalette
│   ├── auth/               #   Auth provider, login shell, Google One Tap, guest sessions
│   ├── bootstrap/          #   Data bootstrap (runtime config fetch)
│   ├── editor/             #   Tiptap editor, math extension, DrawingCanvas
│   ├── editor-collab/      #   Yjs + Supabase Realtime, IndexedDB persistence, durable save
│   ├── export-import/      #   Export/Import/Print services
│   ├── feedback/           #   Feedback modal + API
│   ├── folders/            #   Folder CRUD, queries, mutations, mappers
│   ├── lock-center/        #   Lock service (SHA-256), lock UI, unlock flow
│   ├── media-byos/         #   BYOS media types
│   ├── notes/              #   Note CRUD, queries, mutations, utils, import
│   ├── search/             #   Search engine, search store, filters UI
│   └── settings/           #   Settings CRUD, queries, mutations, defaults
│
├── services/               # Background / cross-cutting services
│   ├── ai/                 #   AI queue processing
│   ├── diagnostics/        #   Runtime diagnostics
│   ├── notifications/      #   Notification service
│   ├── realtime/           #   Realtime subscription management
│   ├── reminders/          #   Reminder scheduling + event publishing
│   ├── sync/               #   Sync queue + consumer (offline-first)
│   ├── console-log-store   #   Diagnostic log store (feedback-only collection)
│   └── event-bus           #   Typed internal event system
│
├── shared/                 # Shared utilities & infrastructure
│   ├── api/                #   Supabase client, OpenRouter client, Google Drive types
│   ├── lib/                #   crypto, i18n, local-storage, search, utils
│   ├── store/              #   Global UI store (Zustand)
│   ├── ui/                 #   Base UI components
│   ├── utils/              #   date, string helpers
│   └── lib/react-query/    #   Query client factory + query keys registry
│
└── middleware.ts           # Next.js middleware (auth redirect, session refresh)
```

---

## Key Systems

### AI Engine
AI operates as a pipeline: after a note changes, it gets `aiStatus = pending` and enters the analysis queue. The pipeline generates `userTags`, `hiddenTags`, suggests `folderId`, calculates `relevance`, assigns `resurfacingClass`. Search must be hybrid: full-text + semantic/vector.

### Editor + Collab
Tiptap editor with Yjs CRDT for collaborative editing. Supabase Realtime transport + IndexedDB persistence. Durable save with debounce and LocalStorage fallback.

### BYOS Media
User files are stored on their own Google Drive. Notes contain only reference `MediaDescriptor` objects. Upload goes through Next.js proxy. Client-side compression to 1920px JPEG 0.8.

### Lock Center
Zero-knowledge protection: SHA-256 password hash on client, content masking, export/print prohibition for locked notes.

### Search Engine
Token normalization, fuzzy matching, RU↔EN keyboard layout fix, transliteration, synonym expansion, weighted field scoring. Hybrid search: full-text + vector retrieval.

---

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`dock/SmartNotes_Structure.txt`](dock/SmartNotes_Structure.txt) | **Primary reference** — stack, architecture, key systems, data model, dev rules |
| [`dock/SmartNotes_Features.txt`](dock/SmartNotes_Features.txt) | **Feature map** — complete functional scope to be reimplemented |
| [`dock/architecture.md`](dock/architecture.md) | Architecture details, data flows, design decisions |
| [`dock/environment.md`](dock/environment.md) | Environment variables, keys, configuration reference |
| [`dock/implementation-status.md`](dock/implementation-status.md) | Current implementation progress by module |

---

## Development Principles

1. **Function over implementation** — when old mechanics conflict with the new stack, preserve the function, not the old code
2. **Offline-first** — IndexedDB fallback, `sync_queue` for offline changes
3. **Partial updates** — frontend sends only changed field deltas
4. **AI as pipeline** — semantic/vector subsystem for classification, retrieval, resurfacing
5. **BYOS** — media stored by user, notes contain only reference representations
6. **Zero-knowledge** — password verification on client, content masked until unlock
7. **PWA required** — installable app, offline shell, system notifications

---
## License

Private project. All rights reserved.
