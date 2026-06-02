# SmartNotes AI Backend API Documentation

This directory contains the documentation for the dedicated **SmartNotes AI Backend** running on Fastify (deployed on Railway). This backend executes all prompt construction, RAG vector searches, and note analyses without Vercel's 60-second timeouts.

---

## 1. Authentication

All requests to the AI Backend must be authenticated using the user's active **Supabase Access Token (JWT)**.
Pass the token in the headers:

```http
Authorization: Bearer <YOUR_SUPABASE_JWT_TOKEN>
```

---

## 2. API Endpoints

### 2.1. Chat Completion (`POST /chat`)

Assembles the user's notes, folders, and conversation history, performs a RAG semantic search, builds the prompt, and queries the AI model.

- **URL:** `/chat`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request Body (JSON):**
  ```json
  {
    "question": "Порекомендуй идеи для проекта",
    "messages": [
      { "role": "user", "text": "Привет!" },
      { "role": "assistant", "text": "Привет! Чем я могу помочь?" }
    ],
    "activeNoteId": "optional-active-note-uuid",
    "activeNoteTitle": "optional-title",
    "activeNoteContent": "optional-content-text"
  }
  ```
- **Response Body (JSON):**
  ```json
  {
    "answer": "Вот несколько идей на основе ваших заметок...",
    "citations": [
      { "id": "note-id-1", "title": "Идеи 2026" }
    ],
    "actions": [
      {
        "type": "addTagsToNotes",
        "noteIds": ["note-id-1"],
        "tags": ["идеи", "планирование"]
      }
    ]
  }
  ```

---

### 2.2. Note Auto-Analysis (`POST /analyze`)

Triggers background note analysis. Extracts user visible tags, hidden semantic tags, relevance score, resurfacing class, and a 1-2 sentence summary. Generates vector embeddings for chunked note content and summary, and saves them in the database.

- **URL:** `/analyze`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request Body (JSON):**
  ```json
  {
    "noteId": "note-uuid-here",
    "title": "Optional title override",
    "content": "Optional content HTML/text override"
  }
  ```
- **Response Body (JSON):**
  ```json
  {
    "status": "queued"
  }
  ```
  *(The analysis runs asynchronously in the background. The note's `ai_status` will transition to `analyzing` and then `done` or `error` in the database).*

---

## 3. Environment Variables (Railway)

Configure these environment variables in your Railway service:

| Variable Name | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Fastify port | `8081` |
| `HOST` | Fastify host | `0.0.0.0` |
| `SUPABASE_URL` | SmartNotes Supabase Project URL | `https://your-ref.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | SmartNotes Supabase Service Role Key | `sb_secret_...` |
| `OPENROUTER_BASE_URL` | AI API base URL | `https://gatewayapi-production-22ba.up.railway.app/v1` |
| `OPENROUTER_API_KEY` | API Key for AI completions | `sk-personal-gw` |
| `OPENROUTER_MODEL` | Target AI Model | `gemini-3.5-flash-thinking` |
| `MATCH_THRESHOLD` | Threshold for folder auto-matching | `0.82` |
