-- SmartNotes AI — Canonical Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Tables match src/shared/api/supabase/types.ts exactly

begin;

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ─── ENUMS ────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'smartnotes_access_role') then
    create type public.smartnotes_access_role as enum ('owner', 'editor', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_invite_status') then
    create type public.smartnotes_invite_status as enum ('pending', 'accepted', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_ai_status') then
    create type public.smartnotes_ai_status as enum ('pending', 'analyzing', 'done', 'error');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_resurfacing_class') then
    create type public.smartnotes_resurfacing_class as enum ('task', 'idea', 'reference', 'archive');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_theme_preset') then
    create type public.smartnotes_theme_preset as enum ('paper', 'smarthub', 'smartlib', 'cyber', 'lego', 'classic');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_lang') then
    create type public.smartnotes_lang as enum ('ru', 'en');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_folder_view_mode') then
    create type public.smartnotes_folder_view_mode as enum ('compact', 'full');
  end if;
  if not exists (select 1 from pg_type where typname = 'smartnotes_plan') then
    create type public.smartnotes_plan as enum ('free', 'pro', 'team');
  end if;
end $$;

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
create or replace function public.smartnotes_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create or replace function public.smartnotes_auth_user_id()
returns uuid language sql stable as $$ select auth.uid(); $$;

create or replace function public.smartnotes_build_note_search_vector(
  input_title text, input_content text, input_tags text[]
) returns tsvector language sql immutable as $$
  select to_tsvector('simple'::regconfig,
    coalesce(input_title,'') || ' ' || coalesce(input_content,'') || ' ' ||
    coalesce(array_to_string(input_tags,' '),''));
$$;

-- ─── TABLES ───────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  plan          public.smartnotes_plan not null default 'free',
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null default 'Новая папка',
  description   text,
  is_hidden     boolean not null default false,
  is_archived   boolean not null default false,
  folder_order  integer not null default 0,
  access_role   public.smartnotes_access_role not null default 'owner',
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  trashed_at    timestamptz
);

create table if not exists public.notes (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  folder_id         uuid references public.folders(id) on delete set null,
  title             text not null default 'Untitled note',
  content           text not null default '',
  user_tags         text[] not null default '{}',
  hidden_tags       text[] not null default '{}',
  pinned            boolean not null default false,
  favorite          boolean not null default false,
  is_archived       boolean not null default false,
  reminder_at       timestamptz,
  lock_version      smallint,
  lock_hash         text,
  lock_salt         text,
  lock_hidden       boolean not null default false,
  manual_order      bigint not null default 0,
  folder_order      bigint,
  ai_status         public.smartnotes_ai_status not null default 'pending',
  ai_processed      boolean not null default false,
  analyzed          boolean not null default false,
  ai_error          text,
  ai_relevance      double precision not null default 0,
  resurfacing_class public.smartnotes_resurfacing_class,
  search_vector     tsvector generated always as (
    public.smartnotes_build_note_search_vector(title, content, user_tags)
  ) stored,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  trashed_at        timestamptz,
  constraint notes_lock_fields_consistent check (
    (lock_version is null and lock_hash is null and lock_salt is null and lock_hidden = false)
    or (lock_version is not null and lock_hash is not null)
  )
);

create table if not exists public.note_pages (
  id               uuid primary key default gen_random_uuid(),
  note_id          uuid not null references public.notes(id) on delete cascade,
  client_page_id   text,
  page_index       integer not null default 0,
  title            text not null default '',
  content          text not null default '',
  drawing_data_url text,
  drawing_revision integer not null default 0,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  unique (note_id, page_index)
);

create table if not exists public.note_media (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid not null references public.notes(id) on delete cascade,
  client_media_id text,
  provider        text not null,
  file_id         text not null,
  url             text,
  mime_type       text not null,
  name            text not null,
  size            bigint not null default 0,
  thumbnail_url   text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now()),
  constraint note_media_provider_check check (provider in ('google-drive','local-inline')),
  constraint note_media_size_check check (size >= 0)
);

create table if not exists public.note_access (
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.smartnotes_access_role not null default 'viewer',
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (note_id, user_id)
);

create table if not exists public.note_invites (
  id             uuid primary key default gen_random_uuid(),
  note_id        uuid not null references public.notes(id) on delete cascade,
  inviter_id     uuid not null references public.profiles(id) on delete cascade,
  invitee_email  text,
  invitee_id     uuid references public.profiles(id) on delete cascade,
  role           public.smartnotes_access_role not null default 'viewer',
  status         public.smartnotes_invite_status not null default 'pending',
  token          text not null default encode(gen_random_bytes(18),'hex'),
  expires_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),
  constraint note_invites_target_present check (invitee_email is not null or invitee_id is not null)
);

create table if not exists public.note_effective_access (
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.smartnotes_access_role not null default 'viewer',
  source     text not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (note_id, user_id),
  constraint note_effective_access_source_check check (source in ('owner','note_access'))
);

create table if not exists public.ai_jobs (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  status       public.smartnotes_ai_status not null default 'pending',
  model        text,
  prompt_version text,
  attempts     integer not null default 0,
  error        text,
  result       jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default timezone('utc', now()),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  constraint ai_jobs_attempts_check check (attempts >= 0)
);

create table if not exists public.note_embeddings (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  chunk_index integer not null default 0,
  content     text not null default '',
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (note_id, chunk_index)
);

create table if not exists public.user_settings (
  id                    uuid primary key references public.profiles(id) on delete cascade,
  preset                public.smartnotes_theme_preset not null default 'paper',
  lang                  public.smartnotes_lang not null default 'ru',
  folder_view_mode      public.smartnotes_folder_view_mode not null default 'full',
  notes_per_page        integer not null default 10 check (notes_per_page in (5,10,20,50)),
  reduce_motion         boolean not null default false,
  ui_opacity            numeric(4,2) not null default 0.88 check (ui_opacity >= 0.4 and ui_opacity <= 1),
  cards_opacity         numeric(4,2) not null default 0.92 check (cards_opacity >= 0.4 and cards_opacity <= 1),
  main_background_url   text,
  sidebar_background_url text,
  custom_presets        jsonb not null default '[]'::jsonb,
  editor                jsonb not null default '{"toolbarVisible":true,"bold":true,"italic":true,"underline":true,"strike":true,"bullets":true,"numbered":true,"hr":true,"alignText":true,"alignMedia":true,"clearFormat":true,"undoRedo":true,"links":true,"pages":true,"inlineTags":true}'::jsonb,
  interface             jsonb not null default '{"showSavedFilters":true,"showTagFilter":true,"showUpdatedPeriodFilter":true}'::jsonb,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  rating         smallint check (rating >= 1 and rating <= 5),
  text           text,
  technical_data jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create unique index if not exists note_pages_note_client_page_id_idx on public.note_pages(note_id, client_page_id) where client_page_id is not null;
create unique index if not exists note_media_note_client_media_id_idx on public.note_media(note_id, client_media_id) where client_media_id is not null;
create unique index if not exists note_invites_token_uidx on public.note_invites(token);
create unique index if not exists note_invites_pending_email_uidx on public.note_invites(note_id, lower(invitee_email)) where status = 'pending' and invitee_email is not null;
create unique index if not exists note_invites_pending_user_uidx on public.note_invites(note_id, invitee_id) where status = 'pending' and invitee_id is not null;

create index if not exists folders_owner_order_idx on public.folders(owner_id, folder_order);
create index if not exists folders_owner_visible_idx on public.folders(owner_id) where trashed_at is null;
create index if not exists notes_owner_updated_idx on public.notes(owner_id, updated_at desc);
create index if not exists notes_folder_order_idx on public.notes(folder_id, folder_order) where trashed_at is null;
create index if not exists notes_tags_idx on public.notes using gin(user_tags);
create index if not exists notes_search_idx on public.notes using gin(search_vector);
create index if not exists notes_pinned_idx on public.notes(owner_id, pinned) where trashed_at is null;
create index if not exists notes_reminder_idx on public.notes(owner_id, reminder_at) where reminder_at is not null and trashed_at is null;
create index if not exists note_pages_note_idx on public.note_pages(note_id, page_index);
create index if not exists note_embeddings_vector_idx on public.note_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists note_effective_access_user_note_idx on public.note_effective_access(user_id, note_id);
create index if not exists ai_jobs_status_idx on public.ai_jobs(status, scheduled_at);

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────
-- note derived state (auto-title from content)
create or replace function public.smartnotes_note_derived_state()
returns trigger language plpgsql as $$
begin
  if coalesce(new.title,'') = '' or new.title = 'Untitled note' then
    new.title := coalesce(nullif(left(trim(coalesce(new.content,'')),80),''), 'Untitled note');
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end; $$;

drop trigger if exists notes_derived_state on public.notes;
create trigger notes_derived_state
before insert or update on public.notes
for each row execute function public.smartnotes_note_derived_state();

-- note_effective_access refresh
create or replace function public.smartnotes_refresh_note_effective_access(target_note_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare note_row public.notes%rowtype;
begin
  select * into note_row from public.notes where id = target_note_id;
  if not found then
    delete from public.note_effective_access where note_id = target_note_id;
    return;
  end if;
  delete from public.note_effective_access where note_id = target_note_id;
  insert into public.note_effective_access (note_id, user_id, role, source)
  values (note_row.id, note_row.owner_id, 'owner', 'owner')
  on conflict (note_id, user_id) do update set role = excluded.role, source = excluded.source;
  insert into public.note_effective_access (note_id, user_id, role, source)
  select na.note_id, na.user_id, na.role, 'note_access'
  from public.note_access as na
  where na.note_id = target_note_id and na.user_id <> note_row.owner_id
  on conflict (note_id, user_id) do update set role = excluded.role, source = excluded.source;
end; $$;

create or replace function public.smartnotes_after_note_change_refresh_effective_access()
returns trigger language plpgsql as $$
begin perform public.smartnotes_refresh_note_effective_access(coalesce(new.id, old.id)); return coalesce(new, old); end; $$;

create or replace function public.smartnotes_after_note_access_change()
returns trigger language plpgsql as $$
begin perform public.smartnotes_refresh_note_effective_access(coalesce(new.note_id, old.note_id)); return coalesce(new, old); end; $$;

create or replace function public.smartnotes_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      avatar_url   = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  insert into public.user_settings (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists folders_touch_updated_at on public.folders;
create trigger folders_touch_updated_at before update on public.folders for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists notes_refresh_effective_access on public.notes;
create trigger notes_refresh_effective_access
after insert or update of owner_id on public.notes
for each row execute function public.smartnotes_after_note_change_refresh_effective_access();

drop trigger if exists note_pages_touch_updated_at on public.note_pages;
create trigger note_pages_touch_updated_at before update on public.note_pages for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists note_access_touch_updated_at on public.note_access;
create trigger note_access_touch_updated_at before update on public.note_access for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists note_access_refresh_effective_access on public.note_access;
create trigger note_access_refresh_effective_access
after insert or update or delete on public.note_access
for each row execute function public.smartnotes_after_note_access_change();

drop trigger if exists note_invites_touch_updated_at on public.note_invites;
create trigger note_invites_touch_updated_at before update on public.note_invites for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists ai_jobs_touch_updated_at on public.ai_jobs;
create trigger ai_jobs_touch_updated_at before update on public.ai_jobs for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists note_embeddings_touch_updated_at on public.note_embeddings;
create trigger note_embeddings_touch_updated_at before update on public.note_embeddings for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at before update on public.user_settings for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists smartnotes_on_auth_user_created on auth.users;
create trigger smartnotes_on_auth_user_created
after insert on auth.users
for each row execute function public.smartnotes_handle_new_user();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.note_pages enable row level security;
alter table public.note_media enable row level security;
alter table public.note_access enable row level security;
alter table public.note_invites enable row level security;
alter table public.note_effective_access enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.note_embeddings enable row level security;
alter table public.user_settings enable row level security;
alter table public.feedback enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- folders
drop policy if exists folders_owner_all on public.folders;
create policy folders_owner_all on public.folders for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- notes — SELECT via note_effective_access (populated by trigger on INSERT)
drop policy if exists notes_owner_or_participant_select on public.notes;
create policy notes_owner_or_participant_select on public.notes for select
using (exists (select 1 from public.note_effective_access nea where nea.note_id = notes.id and nea.user_id = auth.uid()));

-- notes INSERT: owner_id must match auth user
drop policy if exists notes_owner_insert on public.notes;
create policy notes_owner_insert on public.notes for insert with check (owner_id = auth.uid());

-- notes UPDATE/DELETE: owner only
drop policy if exists notes_owner_update on public.notes;
create policy notes_owner_update on public.notes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists notes_owner_delete on public.notes;
create policy notes_owner_delete on public.notes for delete using (owner_id = auth.uid());

-- note_pages
drop policy if exists note_pages_note_select on public.note_pages;
create policy note_pages_note_select on public.note_pages for select
using (exists (select 1 from public.note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = auth.uid()));
drop policy if exists note_pages_note_insert on public.note_pages;
create policy note_pages_note_insert on public.note_pages for insert
with check (exists (select 1 from public.note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')));
drop policy if exists note_pages_note_update on public.note_pages;
create policy note_pages_note_update on public.note_pages for update
using (exists (select 1 from public.note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')))
with check (exists (select 1 from public.note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')));
drop policy if exists note_pages_note_delete on public.note_pages;
create policy note_pages_note_delete on public.note_pages for delete
using (exists (select 1 from public.note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')));

-- note_media (same pattern as note_pages)
drop policy if exists note_media_note_select on public.note_media;
create policy note_media_note_select on public.note_media for select
using (exists (select 1 from public.note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = auth.uid()));
drop policy if exists note_media_note_write on public.note_media;
create policy note_media_note_write on public.note_media for all
using (exists (select 1 from public.note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')))
with check (exists (select 1 from public.note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = auth.uid() and nea.role in ('owner','editor')));

-- note_access
drop policy if exists note_access_owner_all on public.note_access;
create policy note_access_owner_all on public.note_access for all
using (exists (select 1 from public.notes n where n.id = note_access.note_id and n.owner_id = auth.uid()))
with check (exists (select 1 from public.notes n where n.id = note_access.note_id and n.owner_id = auth.uid() and note_access.user_id <> n.owner_id));
drop policy if exists note_access_user_read on public.note_access;
create policy note_access_user_read on public.note_access for select using (user_id = auth.uid());

-- note_invites
drop policy if exists note_invites_read on public.note_invites;
create policy note_invites_read on public.note_invites for select using (inviter_id = auth.uid() or invitee_id = auth.uid());
drop policy if exists note_invites_owner_write on public.note_invites;
create policy note_invites_owner_write on public.note_invites for all using (inviter_id = auth.uid()) with check (inviter_id = auth.uid());

-- note_effective_access
drop policy if exists note_effective_access_read_own on public.note_effective_access;
create policy note_effective_access_read_own on public.note_effective_access for select using (user_id = auth.uid());

-- ai_jobs
drop policy if exists ai_jobs_owner_all on public.ai_jobs;
create policy ai_jobs_owner_all on public.ai_jobs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- note_embeddings
drop policy if exists note_embeddings_owner_all on public.note_embeddings;
create policy note_embeddings_owner_all on public.note_embeddings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- user_settings
drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings for all using (id = auth.uid()) with check (id = auth.uid());

-- feedback
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists feedback_no_read on public.feedback;
create policy feedback_no_read on public.feedback for select using (false);

-- ─── GRANTS ───────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant insert on public.feedback to anon;

-- ─── BACKFILL (safe to run on existing data) ──────────────────────────────────
-- Sync existing auth users → profiles + settings
insert into public.profiles (id, email, display_name, avatar_url)
select u.id, u.email,
  coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do update set
  email        = excluded.email,
  display_name = coalesce(excluded.display_name, public.profiles.display_name),
  avatar_url   = coalesce(excluded.avatar_url, public.profiles.avatar_url);

insert into public.user_settings (id)
select id from public.profiles
on conflict (id) do nothing;

-- Rebuild note_effective_access for all existing notes
select public.smartnotes_refresh_note_effective_access(n.id) from public.notes n;

commit;
