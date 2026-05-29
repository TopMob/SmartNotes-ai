<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Principal Frontend Architect and Distributed Systems Expert. I am building a production-ready, offline-first note-taking app using Next.js (App Router), TypeScript, Supabase, React Query, and IndexedDB (via localforage).

I need a deep architectural blueprint and copy-pasteable TypeScript code templates to solve three interconnected challenges in my offline-first frontend ecosystem.

### CHALLENGE 1: React Hydration Mismatches (SSR vs IndexedDB)

**The Problem:** My Next.js SSR HTML does not match the client-side state loaded from IndexedDB, causing severe React Hydration Mismatch errors and UI layout shifts.
**Deliverables:**

1. A robust, layout-shift-free solution. Provide a custom React hook (e.g., `useHydratedOfflineData`) that safely loads data from localforage only after the client mounts, completely avoiding SSR mismatches.
2. Show exactly how to implement a skeleton loader pattern alongside this hook to prevent Cumulative Layout Shift (CLS).

### CHALLENGE 2: Offline-to-Online Sync \& Conflict Resolution

**The Problem:** I need a bulletproof strategy for when a user edits a note offline, but the remote database (Supabase) might have a newer version.
**Deliverables:**

1. Recommend the most pragmatic conflict resolution approach for text notes (e.g., Timestamp-based Last-Write-Wins vs. lightweight CRDTs).
2. Provide a TypeScript "Background Sync Engine" utility. It should hook into the browser's `online` event, pull an "offline mutation queue" from localforage, and sync changes to Supabase incrementally without blocking the main React thread (Main Thread).

### CHALLENGE 3: React Query Offline Persistence \& Optimistic Updates

**The Problem:** I want the ultimate offline UX where notes load instantly without network waterfalls, and edits feel instantaneous even on 3G or offline.
**Deliverables:**

1. Provide the exact setup configuration to persist the React Query cache into IndexedDB (using `@tanstack/react-query-persist-client` + `localforage` or similar best practice).
2. Write a pristine, copy-pasteable React Query `useMutation` example for updating a note. It must include Optimistic UI logic (updating the local cache instantly before the network request) and offline retry logic (queueing the mutation if offline and executing it automatically when online).

Constraints: Provide strict, production-ready TypeScript code. Do not use generic pseudocode. Ensure all code is compatible with the Next.js App Router environment.

You can make this architecture work cleanly in App Router by (1) never touching IndexedDB during render, (2) treating Supabase as a sync target with a local mutation queue, and (3) letting React Query own both cache and mutation persistence via an IndexedDB/localforage persister.[^1][^2][^3]

Below is a blueprint with copy‑pasteable TypeScript, structured per challenge.

***

## Challenge 1: Hydration-safe offline data

The key is: **render the same HTML on the server and on the client’s first render, and only touch IndexedDB in an effect.** That avoids React hydration mismatches because IndexedDB-derived state never affects the initial render tree. You then use a skeleton that occupies the final layout’s space so there is no CLS when offline data arrives.[^4]

### Hook: `useHydratedOfflineData`

This hook only reads from localforage *after* mount and exposes a simple state machine for caller components.

```ts
// lib/useHydratedOfflineData.ts
"use client";

import { useEffect, useState } from "react";

export type HydratedOfflineState<T> = {
  data: T | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: Error | null;
};

type Loader<T> = () => Promise<T | null>;

export function useHydratedOfflineData<T>(
  key: string,
  loader: Loader<T>
): HydratedOfflineState<T> {
  const [state, setState] = useState<HydratedOfflineState<T>>({
    data: null,
    isLoading: true,
    isHydrated: false,
    error: null,
  });

  useEffect(() => {
    let canceled = false;

    async function run() {
      try {
        const data = await loader();
        if (canceled) return;
        setState({
          data,
          isLoading: false,
          isHydrated: true,
          error: null,
        });
      } catch (error) {
        if (canceled) return;
        setState({
          data: null,
          isLoading: false,
          isHydrated: true,
          error: error as Error,
        });
      }
    }

    void run();

    return () => {
      canceled = true;
    };
    // key is a logical dependency; ensure loader is stable via useCallback at callsite
  }, [key, loader]);

  return state;
}
```

Because this hook only updates state inside `useEffect`, the initial client render matches the SSR HTML (which must render a skeleton or server data independent of IndexedDB), so React has nothing to complain about during hydration.[^4]

### Shared localforage instance

Use a single configured localforage instance for offline cache and queues.

```ts
// lib/localforageClient.ts
import localforage from "localforage";

export const offlineStore = localforage.createInstance({
  name: "smartnotes",
  storeName: "smartnotes_offline",
  description: "Offline cache and mutation queue for SmartNotes",
});
```

localforage uses IndexedDB under the hood in modern browsers, giving you async, large-capacity storage similar to custom IDB persisters in TanStack examples.[^5][^1]

### Skeleton loader with zero CLS

Render a fixed-height skeleton on both server and initial client render, and only swap to content once the hook is hydrated.

```tsx
// app/(notes)/NotesSkeleton.tsx
"use client";

import React from "react";

export function NotesSkeleton() {
  // Use fixed heights to avoid CLS
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[56px] w-full rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse"
        />
      ))}
    </div>
  );
}
```

```tsx
// app/(notes)/NotesListClient.tsx
"use client";

import React, { useCallback } from "react";
import { offlineStore } from "@/lib/localforageClient";
import { useHydratedOfflineData } from "@/lib/useHydratedOfflineData";
import { NotesSkeleton } from "./NotesSkeleton";

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string; // ISO string
};

type Props = {
  // Data you rendered into the HTML on the server (e.g., from Supabase)
  initialNotes: Note[];
};

export function NotesListClient({ initialNotes }: Props) {
  const loadOfflineNotes = useCallback(async () => {
    const stored = await offlineStore.getItem<Note[]>("notes-cache");
    return stored ?? initialNotes;
  }, [initialNotes]);

  const { data: offlineNotes, isHydrated, isLoading } =
    useHydratedOfflineData<Note[]>("notes-cache", loadOfflineNotes);

  // While not hydrated, we render the skeleton only.
  // This HTML matches SSR exactly, so no hydration mismatch.
  if (!isHydrated || isLoading) {
    return <NotesSkeleton />;
  }

  const notes = offlineNotes ?? initialNotes;

  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3"
        >
          <h3 className="font-medium">{note.title}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
            {note.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

In the App Router page, you render this client component from a server component that fetches Supabase data, but the client never touches IndexedDB until after mount:

```tsx
// app/(notes)/page.tsx (server component)
import { createServerClient } from "@/lib/supabaseServer";
import { NotesListClient, Note } from "./NotesListClient";

export default async function NotesPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("notes")
    .select("id,title,content,updated_at")
    .order("updated_at", { ascending: false });

  const initialNotes: Note[] =
    data?.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content ?? "",
      updatedAt: row.updated_at,
    })) ?? [];

  return (
    <main className="max-w-2xl mx-auto p-4">
      <NotesListClient initialNotes={initialNotes} />
    </main>
  );
}
```


***

## Challenge 2: Offline sync \& conflict resolution

For personal, single-user notes, the **most pragmatic strategy is timestamp-based last-write-wins**, with a clear `updated_at` column on the Supabase table and ISO timestamps in the client. Supabase does not yet provide first-class offline replication by itself and recommends building this client-side or using third-party sync layers, so a lightweight LWW scheme is appropriate here.[^6][^2][^7][^8]

### Conflict strategy: LWW with `updated_at`

On Supabase, your `notes` table should have a monotonic `updated_at`:

```sql
-- Run this on Supabase
alter table public.notes
add column if not exists updated_at timestamptz not null default now();

create index if not exists notes_updated_at_idx on public.notes(updated_at desc);
```

Client-side rules:

- Every local mutation gets a `localUpdatedAt = new Date().toISOString()`.
- When syncing a queued mutation, you fetch the current server row and compare `existing.updated_at` vs `localUpdatedAt`.
- If the server timestamp is newer, **server wins, drop the offline mutation** (and optionally surface a “conflict” UI later); if not, apply the queued mutation.[^7][^6]

This keeps the sync logic simple while still avoiding blindly overwriting newer server edits.

### Offline mutation queue model

Define a small queue representation stored in localforage.

```ts
// lib/offlineQueue.ts
"use client";

import { offlineStore } from "./localforageClient";

export type NoteMutationType = "create" | "update" | "delete";

export type NoteMutationBase = {
  id: string; // UUID for the mutation itself
  type: NoteMutationType;
  noteId: string;
  localUpdatedAt: string; // ISO string
};

export type NoteCreateMutation = NoteMutationBase & {
  type: "create";
  payload: {
    title: string;
    content: string;
  };
};

export type NoteUpdateMutation = NoteMutationBase & {
  type: "update";
  payload: {
    title?: string;
    content?: string;
  };
};

export type NoteDeleteMutation = NoteMutationBase & {
  type: "delete";
  payload: {};
};

export type NoteMutation =
  | NoteCreateMutation
  | NoteUpdateMutation
  | NoteDeleteMutation;

const OFFLINE_MUTATIONS_KEY = "notes-offline-mutations-v1";

export async function getOfflineMutations(): Promise<NoteMutation[]> {
  const existing =
    (await offlineStore.getItem<NoteMutation[]>(OFFLINE_MUTATIONS_KEY)) ?? [];
  return existing;
}

export async function enqueueOfflineMutation(
  mutation: NoteMutation
): Promise<void> {
  const existing = await getOfflineMutations();
  existing.push(mutation);
  await offlineStore.setItem(OFFLINE_MUTATIONS_KEY, existing);
}

export async function overwriteOfflineMutations(
  mutations: NoteMutation[]
): Promise<void> {
  await offlineStore.setItem(OFFLINE_MUTATIONS_KEY, mutations);
}
```

This queue is shared between your mutations (for enqueueing) and the background sync engine (for replay).

### Background Sync Engine using `online` events

This engine processes the queue when the browser comes online, applying LWW against Supabase.

```ts
// lib/backgroundSyncEngine.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOfflineMutations,
  overwriteOfflineMutations,
  NoteMutation,
} from "./offlineQueue";

type BackgroundSyncOptions = {
  supabase: SupabaseClient;
  tableName?: string;
};

export function createBackgroundSyncEngine(options: BackgroundSyncOptions) {
  const tableName = options.tableName ?? "notes";

  let isSyncing = false;
  let isStarted = false;

  const processQueue = async () => {
    if (isSyncing) return;
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;

    isSyncing = true;

    try {
      let queue = await getOfflineMutations();
      if (queue.length === 0) return;

      const nextQueue: NoteMutation[] = [];

      for (const mutation of queue) {
        try {
          const localTimestamp = new Date(mutation.localUpdatedAt);

          if (mutation.type === "delete") {
            // We can delete without conflict check, or you can check first.
            const { error } = await options
              .supabase
              .from(tableName)
              .delete()
              .eq("id", mutation.noteId);

            if (error) {
              nextQueue.push(mutation);
            }

            continue;
          }

          // Fetch current server row for conflict resolution
          const { data: existing, error: fetchError } = await options
            .supabase
            .from(tableName)
            .select("id,updated_at")
            .eq("id", mutation.noteId)
            .maybeSingle();

          if (fetchError) {
            nextQueue.push(mutation);
            continue;
          }

          if (existing?.updated_at) {
            const serverTimestamp = new Date(existing.updated_at);
            // Server is newer → discard local mutation (server wins).
            if (serverTimestamp > localTimestamp) {
              continue;
            }
          }

          const updatePayload = {
            ...("title" in mutation.payload
              ? { title: mutation.payload.title }
              : {}),
            ...("content" in mutation.payload
              ? { content: mutation.payload.content }
              : {}),
            updated_at: mutation.localUpdatedAt,
          };

          let error: unknown;

          if (mutation.type === "create") {
            const { error: insertError } = await options
              .supabase
              .from(tableName)
              .insert({
                id: mutation.noteId,
                ...updatePayload,
              });

            error = insertError;
          } else if (mutation.type === "update") {
            const { error: updateError } = await options
              .supabase
              .from(tableName)
              .update(updatePayload)
              .eq("id", mutation.noteId);

            error = updateError;
          }

          if (error) {
            nextQueue.push(mutation);
          }
        } catch {
          // Network or unexpected error → keep mutation for later
          nextQueue.push(mutation);
        }
      }

      await overwriteOfflineMutations(nextQueue);
    } finally {
      isSyncing = false;
    }
  };

  const handleOnline = () => {
    void processQueue();
  };

  const start = () => {
    if (typeof window === "undefined") return;
    if (isStarted) return;
    isStarted = true;

    window.addEventListener("online", handleOnline);
    // Optionally run a sync immediately in case we came back from a reload while online.
    void processQueue();
  };

  const stop = () => {
    if (typeof window === "undefined") return;
    if (!isStarted) return;
    isStarted = false;

    window.removeEventListener("online", handleOnline);
  };

  return {
    start,
    stop,
    syncOnce: processQueue,
  };
}
```

Attach this engine once near the root of your client tree (e.g., in a `SyncProvider` component) so it doesn’t block the main React render thread—everything is async and batched.

```tsx
// app/SyncProvider.tsx
"use client";

import React, { useEffect } from "react";
import { useSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import { createBackgroundSyncEngine } from "@/lib/backgroundSyncEngine";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseBrowserClient();

  useEffect(() => {
    const engine = createBackgroundSyncEngine({ supabase });
    engine.start();
    return () => engine.stop();
  }, [supabase]);

  return <>{children}</>;
}
```

Mount `SyncProvider` inside your root layout body so it’s always active while the app is open.

***

## Challenge 3: React Query persistence \& optimistic updates

TanStack Query exposes a `PersistQueryClientProvider` and a generic `Persister` interface so you can persist query and mutation caches to arbitrary storage backends, including IndexedDB via localforage. With `networkMode: "offlineFirst"` on mutations, React Query will automatically pause retries when offline and resume when online, which plays nicely with your own queue if you want extra control.[^9][^10][^3][^1]

### React Query + localforage persistence setup

Define a persister using localforage and a provider for App Router.

```tsx
// lib/ReactQueryProvider.tsx
"use client";

import React, { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  PersistedClient,
  PersistQueryClientProvider,
  Persister,
} from "@tanstack/react-query-persist-client";
import localforage from "localforage";

// Use a function to avoid cross-request leakage in Next.js
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long cache to make persistence worthwhile
        cacheTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 1000 * 60 * 5,
      },
      mutations: {
        // Let TanStack handle offline pausing/resuming
        networkMode: "offlineFirst",
      },
    },
  });
}

function createLocalforagePersister(): Persister {
  const key = "react-query-cache-v1";

  return {
    persistClient: async (client: PersistedClient) => {
      await localforage.setItem(key, client);
    },
    restoreClient: async () => {
      return (await localforage.getItem<PersistedClient>(key)) ?? undefined;
    },
    removeClient: async () => {
      await localforage.removeItem(key);
    },
  };
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  // On the server, there is no IndexedDB → fall back to plain QueryClientProvider.
  if (typeof window === "undefined") {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  const persister = createLocalforagePersister();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        // Optional: only persist certain queries
        // dehydrateOptions: {
        //   shouldDehydrateQuery: (query) => query.meta?.persist === true,
        // },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

Using an async persister like this mirrors the IndexedDB examples from the TanStack docs and discussions, just swapping `idb-keyval` for localforage.[^3][^5][^1]

In your root layout:

```tsx
// app/layout.tsx
import type { ReactNode } from "react";
import { ReactQueryProvider } from "@/lib/ReactQueryProvider";
import { SyncProvider } from "./SyncProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <SyncProvider>{children}</SyncProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
```


### Optimistic `useMutation` with offline queue + auto retry

This mutation:

- Updates the note in the React Query cache optimistically.
- If offline, enqueues the mutation and returns a synthetic note.
- If a network error occurs, also enqueues and keeps optimistic state (or rolls back on non-network errors).
- Uses `networkMode: "offlineFirst"` so retries automatically resume when the browser comes back online.[^9]

```ts
// features/notes/useUpdateNote.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOfflineMutation } from "@/lib/offlineQueue";
import type { Note } from "@/app/(notes)/NotesListClient";

type UpdateNoteInput = {
  id: string;
  patch: Partial<Pick<Note, "title" | "content">>;
};

type UseUpdateNoteOptions = {
  supabase: SupabaseClient;
  userId: string;
};

function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  const message = (error as { message?: string } | null)?.message ?? "";
  return /NetworkError|Failed to fetch|load failed/i.test(message);
}

export function useUpdateNote({ supabase, userId }: UseUpdateNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["notes", "update"],
    networkMode: "offlineFirst",
    mutationFn: async ({ id, patch }: UpdateNoteInput): Promise<Note> => {
      const updatedAt = new Date().toISOString();

      const enqueueAndReturnOptimistic = async () => {
        await enqueueOfflineMutation({
          id: crypto.randomUUID(),
          type: "update",
          noteId: id,
          localUpdatedAt: updatedAt,
          payload: {
            title: patch.title,
            content: patch.content,
          },
        });

        // Return optimistic representation
        const existing = queryClient
          .getQueryData<Note[]>(["notes"])
          ?.find((n) => n.id === id);

        return {
          id,
          userId,
          title: patch.title ?? existing?.title ?? "",
          content: patch.content ?? existing?.content ?? "",
          updatedAt,
        };
      };

      if (typeof window !== "undefined" && !navigator.onLine) {
        return enqueueAndReturnOptimistic();
      }

      const { data, error } = await supabase
        .from("notes")
        .update({
          title: patch.title,
          content: patch.content,
          updated_at: updatedAt,
        })
        .eq("id", id)
        .select("id,title,content,updated_at")
        .single();

      if (error) {
        if (isLikelyNetworkError(error)) {
          return enqueueAndReturnOptimistic();
        }
        throw error;
      }

      return {
        id: data.id,
        userId,
        title: data.title,
        content: data.content ?? "",
        updatedAt: data.updated_at,
      };
    },

    // Optimistic update
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["notes"] });

      const previousNotes = queryClient.getQueryData<Note[]>(["notes"]);

      const updatedAt = new Date().toISOString();

      queryClient.setQueryData<Note[]>(["notes"], (old) => {
        if (!old) return old;
        return old.map((note) =>
          note.id === id
            ? {
                ...note,
                ...patch,
                updatedAt,
              }
            : note
        );
      });

      return { previousNotes };
    },

    // Rollback only for non-network errors
    onError: (error, _vars, context) => {
      if (!isLikelyNetworkError(error) && context?.previousNotes) {
        queryClient.setQueryData<Note[]>(["notes"], context.previousNotes);
      }
    },

    // Reconcile with server payload when available
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(["notes"], (old) => {
        if (!old) return [note];
        return old.map((n) => (n.id === note.id ? note : n));
      });

      queryClient.invalidateQueries({ queryKey: ["notes", note.id] });
    },
  });
}
```

Usage in a component:

```tsx
// app/(notes)/NoteEditor.tsx
"use client";

import React, { useState } from "react";
import { useSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import { useUpdateNote } from "@/features/notes/useUpdateNote";
import type { Note } from "./NotesListClient";

export function NoteEditor({ note }: { note: Note }) {
  const supabase = useSupabaseBrowserClient();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const updateNote = useUpdateNote({
    supabase,
    userId: note.userId,
  });

  const handleSave = () => {
    updateNote.mutate({
      id: note.id,
      patch: { title, content },
    });
  };

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded border border-neutral-300 px-2 py-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-neutral-300 px-2 py-1"
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={updateNote.isLoading}
        className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {updateNote.isLoading ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
```

Because the React Query cache is persisted via localforage, the optimistic notes list and any queued mutations survive reloads, and `networkMode: "offlineFirst"` ensures the mutation retries line up with the browser’s online/offline lifecycle.[^1][^3][^9]

***

If you’d like, I can next help you:

- Factor this into a small `@smartnotes/offline` package with proper typing and tests, or
- Add a CRDT-based path (e.g. Yjs) for shared note collaboration while keeping the same offline queue shell.
<span style="display:none">[^11][^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://github.com/TanStack/query/discussions/3198

[^2]: https://github.com/orgs/supabase/discussions/357

[^3]: https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient

[^4]: https://dev.to/rayenmabrouk/advanced-server-rendering-react-query-with-nextjs-app-router-bi7

[^5]: https://github.com/TanStack/query/discussions/1638

[^6]: https://www.devadnani.com/blog/flutter-offline-first-supabase

[^7]: https://iotfast.dev/blog/offline-first-iot-dashboards-in-react-native-with-supabase

[^8]: https://www.reddit.com/r/Supabase/comments/qf37b9/working_with_offline_data/

[^9]: https://stackoverflow.com/questions/76708825/how-does-the-persistqueryclient-from-react-query-work

[^10]: https://github.com/TanStack/query/discussions/3568

[^11]: https://www.reddit.com/r/reactjs/comments/10i49j0/reactquery_with_localstorage_persistqueryclient/

[^12]: https://www.reddit.com/r/nextjs/comments/1laggb4/nextjs_15_app_router_react_query/

[^13]: https://www.youtube.com/watch?v=LpbEdr_CCgM

[^14]: https://tanstack.com/query/v4/docs/framework/react/plugins/createSyncStoragePersister

[^15]: https://github.com/marceljuenemann/rxdb-supabase

