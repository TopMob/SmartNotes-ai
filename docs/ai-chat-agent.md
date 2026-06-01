# AI Chat & Agentic Actions (Semantic Co-Pilot)

> The system architecture, data flows, API specifications, and compatibility layers for the SmartNotes AI Co-Pilot.

---

## 1. Architectural Overview

The AI Chat operates as a premium, Gmail-style slide-in side panel (Semantic Co-Pilot) that enables users to query their database of notes, discover links, and command the AI agent to organize their workspace.

```
[ UI Toggle (Sparkles) ] ────► [ Zustand Store (aiChatOpen) ] ────► [ AiChatPanel Drawer ]
                                                                             │
                                                                             ▼
[ AI Chat POST request ] ◄───────────────────────────────────────────────────┘
   │  (Passes client notes & folders metadata)
   │
   ├─► [ Authenticated? ]
   │     ├─► [ YES ] ──► [ Supabase pgvector RPC (match_note_embeddings) ] ────┐
   │     └─► [ NO ]  ──► [ Local client-side chunks & embedding loop ] ────────┤
   │                                                                           ▼
   │                                                             [ Semantic RAG Chunks ]
   ▼
[ OpenRouter / Codex Sale Completion ] (Strict JSON formatted prompt)
   │
   ▼
[ Response Sanitization (cleanJsonResponse) & Parser ]
   │
   ▼
[ JSON Response ] ────► [ Answer Text (Markdown) & Citations ]
                      └─► [ Agentic Actions (folders, movements, tags) ]
```

---

## 2. Interface: Header Toggle Button
The entry point to the AI Chat is a prominent Sparkles AI button embedded in [Header.tsx](file:///c:/Users/TopMob/Documents/Projects/TopMob/SmartNotes-ai/src/features/app-shell/ui/components/Header.tsx):
* **State Management**: Binds to `aiChatOpen` and `toggleAiChat` inside the Zustand global store (`useUiStore`).
* **Design & Feel**: Adapts standard premium glassmorphism styling, showing a vibrant, pulsating violet background and subtle glowing shadow (`shadow-[0_0_15px_rgba(124,58,237,0.4)]`) when active.

---

## 3. High-Performance Hybrid RAG Search

To keep the application highly responsive, vector searching is strictly optimized to avoid heavy server-side CPU loops:

1. **Authenticated Users**: The Next.js route handler bypasses CPU-heavy local embedding loops. It calculates a single vector embedding for the *user's question* and calls Supabase's indexed pgvector RPC `match_note_embeddings` which queries matching chunks in milliseconds.
2. **Guest Sessions (Offline)**: If the user is unauthenticated, the client's notes are embedded locally inside a lightweight loop to search for vector proximity.
3. **Prompt assembly**: Semantic chunks are matched, deduplicated into citations, and injected into the prompt as `{{RAG_CONTEXT}}`.

---

## 4. Agentic Actions (JSON-Mode & Codex Sale Compatibility)

When a user requests organization tasks (e.g. *"создай папку 'Работа' и перенеси туда заметку по дизайну"*), the LLM processes metadata context and returns structured command objects.

### 4.1 Supported Command Schema
```json
{
  "answer": "Я сгруппировал твои заметки по дизайну и создал новую папку...",
  "actions": [
    {
      "type": "createFolder",
      "folderName": "Дизайн",
      "tempId": "temp-folder-1"
    },
    {
      "type": "moveNotesToFolder",
      "folderId": "existing-folder-uuid", // if folder already exists
      "folderName": "Дизайн",               // folder name
      "tempId": "temp-folder-1",            // links to createFolder action above
      "noteIds": ["note-id-123"]
    },
    {
      "type": "addTagsToNotes",
      "noteIds": ["note-id-123"],
      "tags": ["дизайн", "референсы"]
    }
  ]
}
```

### 4.2 Codex Sale / OpenRouter Reasoning Compatibility
Many custom reasoning endpoints and providers (like `gpt-5.4` on Codex Sale) reject explicit `"response_format": { "type": "json_object" }` request parameters inside the API payload, causing `upstream_bad_request` errors.

* **Compatibility Fix**: SmartNotes AI **omits** the `response_format` option in API calls. Instead, the prompt strictly enforces JSON structure.
* **Sanitization Helper**: The backend runs `cleanJsonResponse` to strip markdown wrapping (` ```json ` or ` ``` `) returning a pure JSON string that is parsed safely with robust fallbacks.

---

## 5. Client-Side Sequential Executor

Suggestions are presented to the user in a gorgeous glassmorphic Action Card before any mutation runs, keeping the user in full control.

### Execution Workflow (TanStack Mutators)
When the user clicks **«Выполнить»** (Execute):
1. **Status Transition**: Updates the message state (`actionsStatus`) to `"running"`.
2. **Sequential Creation**: Creates folders (`addFolder`) one-by-one. Each successful creation returns the real database folder UUID, which is saved in a local map `tempIdMap[tempId] = databaseId`.
3. **Relocation & Tagging**:
   - Resolves target folder IDs (resolving temporary `tempId` values to database UUIDs) and executes `moveNoteToFolder` sequentially.
   - Retrieves the existing note tag arrays, merges them with new suggested tags, and triggers `patchNote` with deduplicated arrays.
4. **Cache Invalidation**: Leverages TanStack React Query mutations (`mutateAsync`) which automatically invalidates notes/folders queries, triggering an instantaneous update in the sidebar, folders grids, and main lists!
