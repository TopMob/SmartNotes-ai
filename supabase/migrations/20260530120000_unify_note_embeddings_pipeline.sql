-- Retire the deprecated whole-note embedding pipeline.
-- SmartNotes uses chunk-based embeddings in public.note_embeddings as the single semantic source of truth.

drop trigger if exists notes_embedding_webhook on public.notes;
drop function if exists public.notes_embedding_webhook_fn();

alter table public.notes
  drop column if exists embedding,
  drop column if exists embedding_status;

drop index if exists public.notes_embedding_hnsw_cosine;
