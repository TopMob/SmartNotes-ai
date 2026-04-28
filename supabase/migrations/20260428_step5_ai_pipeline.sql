create table if not exists public.note_chunks (
  id uuid primary key,
  note_id uuid not null,
  chunk_index integer not null,
  chunk_hash text not null,
  plain_text text not null,
  embedding_status text not null default 'pending',
  classification_status text not null default 'pending',
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_note_chunks_note_id_chunk_index on public.note_chunks(note_id, chunk_index);
create index if not exists idx_note_chunks_note_id_chunk_hash on public.note_chunks(note_id, chunk_hash);
