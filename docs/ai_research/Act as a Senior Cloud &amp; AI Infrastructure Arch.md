<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Senior Cloud \& AI Infrastructure Architect. I am building a collaborative, local-first note-taking PWA. The complete context of my tech stack (Next.js 15, Supabase, Yjs, pgvector, Transformers.js) is attached in the provided files.

My current challenge is guaranteeing that ALL notes are completely analyzed (vector embeddings generated, metadata extracted, and indexed) seamlessly in the background. I need to ensure this happens EVEN IF the user who created or edited the note immediately closes the app, loses internet, or is completely offline.

I want a bulletproof architectural design to ensure absolutely no unanalyzed notes are left behind. Please provide a blueprint addressing:

1. Hybrid Background Processing \& Fallback: Since my primary AI engine is local (Transformers.js via Web Worker), how do I architect a reliable fallback mechanism? If the client goes offline mid-analysis, how should the backend (e.g., Supabase Edge Functions, pg_cron, or a background worker) detect and automatically process these orphaned unanalyzed notes?
2. State Management \& Reconciliation: What is the optimal database schema and state-machine pattern to track the "analysis lifecycle" (e.g., pending, processing, completed, failed) of a note? How do I prevent race conditions where both the client and the backend try to analyze the same note simultaneously?
3. Event-Driven Triggers: How can I use database webhooks or CRDT (Yjs) sync events to reliably trigger this background analysis pipeline without overwhelming the system during bulk syncs?

Provide concrete architectural patterns, state-tracking logic, and best practices specific to this hybrid local/cloud stack.

You want the AI pipeline to be **durable, replayable, and idempotent**, not “best effort.” In your stack, the safest design is: the client should *request* analysis when possible, but the database must be the source of truth for unfinished work, with a server-side reconciler that reclaims any note left in `pending` or `processing` too long. Your docs already point in that direction: notes enter an AI queue, analysis is persisted, and embeddings are stored in `note_embeddings` for hybrid search.[^1][^2]

## Core blueprint

Use a two-layer model:

- **Client layer**: opportunistic fast path. The browser analyzes locally with Transformers.js in a Web Worker and immediately writes results if online.
- **Server layer**: authoritative fallback and repair path. A backend worker periodically scans for notes whose analysis is missing, stale, or abandoned, then processes them until completion.

That means every note must be recoverable from a single truth table, not from localStorage or the browser session. Your current local queue in `smartnotes:ai:pending` is good as a short-lived accelerator, but it cannot be the durability boundary because it disappears if the app state is lost.[^3][^1]

## Fallback architecture

### 1) Treat analysis as a durable job

Create an `ai_jobs` row whenever a note becomes eligible for analysis, and keep `notes.ai_status` as a denormalized UI shortcut. Your docs already include `ai_jobs`, `notes`, and `note_embeddings`, which is the right split for this problem.[^2]

Recommended flow:

1. Note changes locally and syncs to Supabase.
2. A DB trigger or server mutation creates/updates an `ai_jobs` row keyed by `note_id`.
3. Client worker processes immediately if online.
4. If the client is offline, closed, or crashes, the job remains in the queue.
5. A backend worker reclaims stale jobs and finishes them.

### 2) Backend fallback options

Use them in this order of reliability:

- **Primary fallback**: a Supabase Edge Function invoked by a server-side scheduler or queue consumer.
- **Secondary fallback**: `pg_cron` to periodically wake a reconciliation SQL function.
- **Best durability**: an external always-on worker service that polls `ai_jobs` and processes locked jobs.

For your “absolutely no unanalyzed notes left behind” requirement, the database plus an always-on worker is the most bulletproof choice. `pg_cron` is excellent as a safety net, but it is not ideal as the only executor because it is scheduled, not continuously available.

### 3) Orphan detection

The backend should reclaim jobs using a lease timeout, not a simple status flag. For example:

- `pending`: queued, not yet claimed.
- `processing`: claimed by a worker, lease active.
- `completed`: analysis persisted.
- `failed_retryable`: transient failure, backoff allowed.
- `failed_terminal`: permanently failed after max retries.
- `stale_processing`: lease expired, safe to reclaim.

A job in `processing` becomes orphaned if `locked_at < now() - interval 'N minutes'` or `heartbeat_at` is too old. The reconciler then atomically reclaims it and restarts analysis.

## State machine and schema

### Notes table

Keep the note-level fields minimal and UI-friendly:


| Column | Purpose |
| :-- | :-- |
| `analysis_state` | `pending`, `processing`, `completed`, `failed`, `stale` |
| `analysis_version` | Incremented whenever content changes |
| `analysis_requested_at` | When the note became eligible |
| `analysis_started_at` | When processing began |
| `analysis_completed_at` | When finished |
| `analysis_error` | Last error summary |
| `analysis_lease_owner` | Worker/client identifier |
| `analysis_lease_expires_at` | Lease timeout |
| `content_hash` | Snapshot hash for idempotency |
| `analysis_hash` | Hash of the analyzed content |

You can keep `ai_status` for compatibility, but the real control should live in job rows, not only in `notes`. Your existing docs already describe status transitions around `pending`, `analyzing`, and `done`.[^3][^1]

### AI jobs table

Use `ai_jobs` as the durable queue and lock registry:

- `id`
- `note_id`
- `user_id`
- `status`
- `priority`
- `attempt_count`
- `max_attempts`
- `locked_by`
- `locked_at`
- `lease_expires_at`
- `content_hash`
- `payload_version`
- `last_error`
- `next_retry_at`
- `created_at`
- `updated_at`

Add a unique partial constraint so only one active job exists per note/version, for example on `(note_id, content_hash)` where status is not terminal.

### Idempotency rule

Every analysis result must be tied to the exact note snapshot that produced it. If the note changed while the job was running, the worker should compare `content_hash` or `analysis_version` before writing results. If they differ, discard the old result and requeue.

That prevents stale embeddings or tags from overwriting newer content.

## Race-condition control

### 1) Use atomic claiming

Do not let both client and backend “start analysis” by just reading state. Instead, claim a job with a single atomic update:

- `UPDATE ai_jobs SET status='processing', locked_by=..., locked_at=now(), lease_expires_at=now()+interval '5 minutes'`
- `WHERE id = ... AND status IN ('pending','stale_processing')`
- `RETURNING *`

Only one actor gets the row. Everyone else backs off.

### 2) Use optimistic version checks on write

When analysis completes, write back only if the note still matches the analyzed version:

- `WHERE note_id = $1 AND analysis_version = $expected_version AND analysis_state = 'processing'`

If not, another edit already invalidated the job.

### 3) Prefer `FOR UPDATE SKIP LOCKED` for workers

For backend workers scanning many jobs, use a query pattern like `SELECT ... FOR UPDATE SKIP LOCKED LIMIT N`. This makes bulk processing safe and parallelizable without duplicate work.

### 4) Heartbeats for long analyses

If embedding generation or LLM calls can take a while, the worker should refresh `heartbeat_at` periodically. That lets the system distinguish a slow job from a dead one.

## Event-driven triggers

### Best trigger chain

Use multiple triggers, each serving a different reliability role:

- **Client event**: when a note is saved, enqueue local analysis immediately.
- **DB trigger**: on insert/update to note content, upsert `ai_jobs`.
- **Realtime subscription**: clients and workers observe job changes for UI updates.
- **Scheduled reconciliation**: every few minutes, find orphaned jobs and process them.

This matches your architecture’s existing split between offline local state, Supabase sync, and background queue processing.[^1][^2]

### Avoiding bulk sync storms

Bulk Yjs syncs can generate many tiny content changes. To prevent analysis overload:

- Debounce job creation until a note is “stable” for a short window.
- Only enqueue when meaningful fields change, not every keystroke.
- Collapse multiple edits into a single `analysis_version`.
- Use per-user or per-device rate limits.
- Batch queue insertion in the database instead of emitting one job per patch.

A good pattern is: content saves can be frequent, but analysis should be edge-triggered on “sync settled,” not on raw Yjs transaction volume. Your docs already use debounced durable saves and a sequential AI queue, which is the right direction.[^3][^1]

## Reliable trigger design

### Option A: DB trigger + worker

This is the strongest design.

1. `notes` row updates.
2. Trigger detects an analysis-relevant delta.
3. Trigger upserts `ai_jobs`.
4. Worker claims and processes jobs.
5. Worker writes embeddings and metadata.
6. Worker marks job complete.

This is ideal because it survives browser death and offline mode.

### Option B: Realtime event + queue

Good for responsiveness, but not sufficient alone.

1. Supabase Realtime notifies a service when note content changes.
2. Service enqueues analysis job.
3. Worker processes later.

Use this as a supplement, not as the only trigger, because Realtime delivery is not the durability layer.

### Option C: Client-first with server reconciliation

This works well for your local-first UX:

1. Client worker analyzes immediately when online.
2. Client writes a durable job record before or alongside local analysis.
3. Server scanner periodically reclaims anything unfinished.

This gives the best user-perceived speed while still guaranteeing eventual completion.

## Recommended implementation pattern

### 1) On note mutation

- Save note content normally.
- Compute `content_hash`.
- If the semantic content changed, set `analysis_state='pending'` and increment `analysis_version`.
- Upsert an `ai_jobs` record.


### 2) Client worker

- Claim the job if online and not already processing.
- Run Transformers.js in a Web Worker.
- Store embeddings and metadata locally if needed for immediate UI.
- Send results to the backend with the version and hash.


### 3) Server worker

- Scan `ai_jobs` for `pending`, `stale_processing`, or missing-result notes.
- Claim with lease locking.
- Recompute embeddings and metadata.
- Upsert `note_embeddings`.
- Write note metadata and mark job complete.


### 4) Reconciler

Run every few minutes and on app bootstrap:

- Find notes with `analysis_state != completed`.
- Find completed notes without embeddings.
- Find jobs stuck beyond lease expiry.
- Requeue or repair them.


## What “bulletproof” means here

Absolute guarantees come from **periodic reconciliation plus idempotent reprocessing**, not from any single event. The browser can disappear, the network can fail, and Yjs can keep syncing later; the job still survives because the database holds the work item and the worker can always reclaim it. In practice, this is the pattern that prevents “lost” notes from remaining unanalyzed indefinitely.[^1][^3]

## Suggested minimum set

If you want the shortest production-safe version:

- `notes.analysis_version`
- `notes.analysis_state`
- `ai_jobs` with lease fields
- atomic claim query
- `content_hash` idempotency
- backend reconciler every 1–5 minutes
- client fast-path worker for immediate analysis
- DB trigger on note save to upsert jobs

That combination is enough to make orphaned notes self-heal.

Would you like me to turn this into a concrete Supabase schema and SQL trigger/worker design next?
<span style="display:none">[^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: architecture.md

[^2]: readme.md

[^3]: note-lifecycle.md

[^4]: ai-copilot.md

[^5]: structure.md

[^6]: provider.md

[^7]: implementation-status.md

[^8]: features.md

[^9]: environment.md

