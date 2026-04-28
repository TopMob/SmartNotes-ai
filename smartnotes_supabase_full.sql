begin;

create extension if not exists pgcrypto;

do $$
begin
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
end
$$;

create or replace function public.smartnotes_strip_html(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(coalesce(value, ''), '<[^>]*>', ' ', 'g'));
$$;

create or replace function public.smartnotes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.smartnotes_is_note_participant(target_owner_id uuid, target_access jsonb)
returns boolean
language sql
stable
as $$
  select (
    auth.uid() = target_owner_id
    or exists (
      select 1
      from jsonb_array_elements(coalesce(target_access, '[]'::jsonb)) as item
      where (item ->> 'userId')::uuid = auth.uid()
        and coalesce(item ->> 'status', 'pending') = 'accepted'
    )
  );
$$;

create or replace function public.smartnotes_note_derived_state()
returns trigger
language plpgsql
as $$
declare
  pages_json jsonb := coalesce(new.pages::jsonb, '[]'::jsonb);
begin
  new.content := trim(both from (
    select string_agg(trim(both from coalesce(page ->> 'content', '')), E'\n\n')
    from jsonb_array_elements(pages_json) as page
  ));

  if coalesce(new.title, '') = '' then
    new.title := left(coalesce(new.content, ''), 80);
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.smartnotes_refresh_note_effective_access(target_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note_row public.notes%rowtype;
begin
  select *
  into note_row
  from public.notes
  where id = target_note_id;

  if not found then
    delete from public.note_effective_access where note_id = target_note_id;
    return;
  end if;

  delete from public.note_effective_access where note_id = target_note_id;

  insert into public.note_effective_access (note_id, user_id, role, source)
  values (note_row.id, note_row.owner_id, 'owner', 'owner');

  insert into public.note_effective_access (note_id, user_id, role, source)
  select
    note_row.id,
    (item ->> 'userId')::uuid,
    coalesce((item ->> 'role')::public.smartnotes_access_role, 'viewer'::public.smartnotes_access_role),
    'access_json'
  from jsonb_array_elements(coalesce(note_row.access, '[]'::jsonb)) as item
  where item ? 'userId'
    and coalesce(item ->> 'status', 'pending') = 'accepted'
  on conflict (note_id, user_id) do update
  set role = excluded.role,
      source = excluded.source,
      updated_at = timezone('utc', now());
end;
$$;

create or replace function public.smartnotes_sync_note_effective_access_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.smartnotes_refresh_note_effective_access(old.id);
    return old;
  end if;

  perform public.smartnotes_refresh_note_effective_access(new.id);
  return new;
end;
$$;

create or replace function public.smartnotes_sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = timezone('utc', now());

  insert into public.user_settings (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  is_hidden boolean not null default false,
  is_archived boolean not null default false,
  folder_order integer not null default 0,
  access_role public.smartnotes_access_role not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  trashed_at timestamptz
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default '',
  content text not null default '',
  pages jsonb not null default '[]'::jsonb,
  user_tags text[] not null default '{}',
  hidden_tags text[] not null default '{}',
  media jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  favorite boolean not null default false,
  is_archived boolean not null default false,
  reminder_at timestamptz,
  lock jsonb,
  access jsonb not null default '[]'::jsonb,
  manual_order integer not null default 0,
  folder_order integer,
  ai_status public.smartnotes_ai_status not null default 'pending',
  ai_processed boolean not null default false,
  analyzed boolean not null default false,
  ai_error text,
  ai_relevance integer not null default 0,
  resurfacing_class public.smartnotes_resurfacing_class,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  trashed_at timestamptz
);

create table if not exists public.note_effective_access (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.smartnotes_access_role not null,
  source text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (note_id, user_id)
);

create table if not exists public.note_chunks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  chunk_index integer not null,
  chunk_hash text not null,
  plain_text text not null,
  embedding_status public.smartnotes_ai_status not null default 'pending',
  classification_status public.smartnotes_ai_status not null default 'pending',
  embedding_model text,
  prompt_version text,
  relevance_decay_rate numeric(6,4) not null default 0.0000,
  last_analyzed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (note_id, chunk_index)
);

create table if not exists public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  preset public.smartnotes_theme_preset not null default 'paper',
  lang public.smartnotes_lang not null default 'ru',
  folder_view_mode public.smartnotes_folder_view_mode not null default 'full',
  notes_per_page integer not null default 10 check (notes_per_page in (5, 10, 20, 50)),
  reduce_motion boolean not null default false,
  ui_opacity numeric(3,2) not null default 0.88 check (ui_opacity between 0.40 and 1.00),
  cards_opacity numeric(3,2) not null default 0.92 check (cards_opacity between 0.40 and 1.00),
  main_background_url text,
  sidebar_background_url text,
  custom_presets jsonb not null default '[]'::jsonb,
  editor jsonb not null default '{"toolbarVisible":true,"bold":true,"italic":true,"underline":true,"strike":true,"bullets":true,"numbered":true,"hr":true,"alignText":true,"alignMedia":true,"clearFormat":true,"undoRedo":true,"links":true,"pages":true,"inlineTags":true}'::jsonb,
  interface jsonb not null default '{"showSavedFilters":true,"showTagFilter":true,"showUpdatedPeriodFilter":true}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_folders_owner_id on public.folders (owner_id);
create index if not exists idx_folders_folder_order on public.folders (owner_id, folder_order);
create index if not exists idx_folders_trashed_at on public.folders (trashed_at);
create index if not exists idx_notes_owner_id on public.notes (owner_id);
create index if not exists idx_notes_folder_id on public.notes (folder_id);
create index if not exists idx_notes_updated_at on public.notes (updated_at desc);
create index if not exists idx_notes_trashed_at on public.notes (trashed_at);
create index if not exists idx_notes_reminder_at on public.notes (reminder_at);
create index if not exists idx_notes_ai_status on public.notes (ai_status);
create index if not exists idx_notes_resurfacing_class on public.notes (resurfacing_class);
create index if not exists idx_note_effective_access_user_id on public.note_effective_access (user_id);
create index if not exists idx_note_effective_access_note_id on public.note_effective_access (note_id);
create index if not exists idx_note_chunks_note_id_chunk_hash on public.note_chunks (note_id, chunk_hash);
create index if not exists idx_note_chunks_updated_at on public.note_chunks (updated_at desc);
create index if not exists idx_user_settings_updated_at on public.user_settings (updated_at desc);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.smartnotes_touch_updated_at();

drop trigger if exists trg_folders_updated_at on public.folders;
create trigger trg_folders_updated_at
before update on public.folders
for each row
execute function public.smartnotes_touch_updated_at();

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
before update on public.notes
for each row
execute function public.smartnotes_touch_updated_at();

drop trigger if exists trg_note_chunks_updated_at on public.note_chunks;
create trigger trg_note_chunks_updated_at
before update on public.note_chunks
for each row
execute function public.smartnotes_touch_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.smartnotes_touch_updated_at();

drop trigger if exists trg_smartnotes_note_derived_state on public.notes;
create trigger trg_smartnotes_note_derived_state
before insert or update of title, pages, user_tags, folder_id
on public.notes
for each row
execute function public.smartnotes_note_derived_state();

drop trigger if exists trg_smartnotes_note_effective_access on public.notes;
create trigger trg_smartnotes_note_effective_access
after insert or update of owner_id, access on public.notes
for each row
execute function public.smartnotes_sync_note_effective_access_trigger();

drop trigger if exists trg_smartnotes_note_effective_access_delete on public.notes;
create trigger trg_smartnotes_note_effective_access_delete
after delete on public.notes
for each row
execute function public.smartnotes_sync_note_effective_access_trigger();

drop trigger if exists on_auth_user_created_smartnotes on auth.users;
create trigger on_auth_user_created_smartnotes
after insert on auth.users
for each row
execute function public.smartnotes_sync_profile_from_auth();

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.note_effective_access enable row level security;
alter table public.note_chunks enable row level security;
alter table public.user_settings enable row level security;

grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all routines in schema public to service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_effective_access to authenticated;
grant select, insert, update, delete on public.note_chunks to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant execute on all routines in schema public to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists folders_select_accessible on public.folders;
create policy folders_select_accessible on public.folders
for select
using (auth.uid() = owner_id);

drop policy if exists folders_insert_own on public.folders;
create policy folders_insert_own on public.folders
for insert
with check (auth.uid() = owner_id);

drop policy if exists folders_update_own on public.folders;
create policy folders_update_own on public.folders
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists folders_delete_own on public.folders;
create policy folders_delete_own on public.folders
for delete
using (auth.uid() = owner_id);

drop policy if exists notes_select_accessible on public.notes;
create policy notes_select_accessible on public.notes
for select
using (public.smartnotes_is_note_participant(owner_id, access));

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
for insert
with check (auth.uid() = owner_id);

drop policy if exists notes_update_accessible on public.notes;
create policy notes_update_accessible on public.notes
for update
using (public.smartnotes_is_note_participant(owner_id, access))
with check (public.smartnotes_is_note_participant(owner_id, access));

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own on public.notes
for delete
using (auth.uid() = owner_id);

drop policy if exists note_effective_access_read on public.note_effective_access;
create policy note_effective_access_read on public.note_effective_access
for select
using (auth.uid() = user_id);

drop policy if exists note_effective_access_manage_owner on public.note_effective_access;
create policy note_effective_access_manage_owner on public.note_effective_access
for all
using (
  exists (
    select 1
    from public.notes n
    where n.id = note_effective_access.note_id
      and n.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.notes n
    where n.id = note_effective_access.note_id
      and n.owner_id = auth.uid()
  )
);

drop policy if exists note_chunks_select_accessible on public.note_chunks;
create policy note_chunks_select_accessible on public.note_chunks
for select
using (
  exists (
    select 1
    from public.notes n
    where n.id = note_chunks.note_id
      and public.smartnotes_is_note_participant(n.owner_id, n.access)
  )
);

drop policy if exists note_chunks_manage_owner on public.note_chunks;
create policy note_chunks_manage_owner on public.note_chunks
for all
using (
  exists (
    select 1
    from public.notes n
    where n.id = note_chunks.note_id
      and n.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.notes n
    where n.id = note_chunks.note_id
      and n.owner_id = auth.uid()
  )
);

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
for select
using (auth.uid() = id);

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
for insert
with check (auth.uid() = id);

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
for update
using (auth.uid() = id)
with check (auth.uid() = id);

insert into public.profiles (id, email, display_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = timezone('utc', now());

insert into public.user_settings (id)
select u.id
from auth.users u
on conflict (id) do nothing;

select public.smartnotes_refresh_note_effective_access(n.id)
from public.notes n;

commit;
