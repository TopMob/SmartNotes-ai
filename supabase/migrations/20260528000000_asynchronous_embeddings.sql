-- migrate:disable-transaction

-- 0. Enable the pg_net extension
create extension if not exists pg_net;

-- 1. Add columns to notes table if they do not exist
alter table public.notes add column if not exists embedding vector(384);
alter table public.notes add column if not exists embedding_status text not null default 'pending';

-- 2. Create index on updated_at for fast sort queries
create index if not exists notes_updated_at_idx on public.notes (updated_at desc);

-- 3. Create high-performance HNSW index concurrently for vector cosine similarity queries
create index concurrently if not exists notes_embedding_hnsw_cosine
  on public.notes
  using hnsw (embedding vector_cosine_ops);

-- 4. Create trigger webhook PL/pgSQL function to run asynchronously
create or replace function public.notes_embedding_webhook_fn()
returns trigger as $$
declare
  payload jsonb;
begin
  -- Build the webhook payload
  payload := jsonb_build_object(
    'type', tg_op,
    'table', 'notes',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  -- Perform the HTTP POST via pg_net to Deno Edge function
  perform net.http_post(
    url := 'https://ammpwqfcutlyrjcarubc.supabase.co/functions/v1/generate-note-embedding',
    body := payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  
  return new;
end;
$$ language plpgsql;

-- 5. Bind the trigger function on INSERT and UPDATE of note content
drop trigger if exists notes_embedding_webhook on public.notes;
create trigger notes_embedding_webhook
after insert or update of content
on public.notes
for each row
execute procedure public.notes_embedding_webhook_fn();
