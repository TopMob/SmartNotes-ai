begin;

create extension if not exists pgcrypto;
create extension if not exists vector;

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

create or replace function public.smartnotes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.smartnotes_auth_user_id()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;

create or replace function public.smartnotes_is_note_participant(target_owner_id text, target_access jsonb)
returns boolean
language sql
stable
as $$
  select (
    public.smartnotes_auth_user_id() = target_owner_id
    or exists (
      select 1
      from jsonb_array_elements(coalesce(target_access, '[]'::jsonb)) as item
      where item ->> 'userId' = public.smartnotes_auth_user_id()
        and coalesce(item ->> 'status', 'pending') = 'accepted'
    )
  );
$$;

create or replace function public.smartnotes_note_derived_state()
returns trigger
language plpgsql
as $$
declare
  pages_json jsonb := coalesce(new.pages, '[]'::jsonb);
begin
  if jsonb_array_length(pages_json) > 0 then
    new.content := trim(both from coalesce((
      select string_agg(trim(both from coalesce(page ->> 'content', '')), E'\n\n')
      from jsonb_array_elements(pages_json) as page
    ), ''));
  end if;

  if coalesce(new.title, '') = '' then
    new.title := left(coalesce(new.content, ''), 80);
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id text primary key,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id text primary key default ('folder_' || gen_random_uuid()::text),
  owner_id text not null references public.profiles(id) on delete cascade,
  name text not null default 'Новая папка',
  description text,
  is_hidden boolean not null default false,
  is_archived boolean not null default false,
  folder_order integer not null default 0,
  access_role public.smartnotes_access_role not null default 'owner',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  trashed_at timestamptz
);

create table if not exists public.notes (
  id text primary key default ('note_' || gen_random_uuid()::text),
  owner_id text not null references public.profiles(id) on delete cascade,
  folder_id text references public.folders(id) on delete set null,
  title text not null default 'Untitled note',
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
  manual_order bigint not null default 0,
  folder_order bigint,
  ai_status public.smartnotes_ai_status not null default 'pending',
  ai_processed boolean not null default false,
  analyzed boolean not null default false,
  ai_error text,
  ai_relevance double precision not null default 0,
  resurfacing_class public.smartnotes_resurfacing_class,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || array_to_string(user_tags, ' '))
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  trashed_at timestamptz
);

create table if not exists public.note_effective_access (
  note_id text not null references public.notes(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role public.smartnotes_access_role not null default 'viewer',
  source text not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (note_id, user_id)
);

create table if not exists public.note_invites (
  id text primary key default ('invite_' || gen_random_uuid()::text),
  note_id text not null references public.notes(id) on delete cascade,
  inviter_id text not null references public.profiles(id) on delete cascade,
  invitee_email text,
  invitee_id text references public.profiles(id) on delete cascade,
  role public.smartnotes_access_role not null default 'viewer',
  status public.smartnotes_invite_status not null default 'pending',
  token text not null default encode(gen_random_bytes(18), 'hex'),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_jobs (
  id text primary key default ('ai_' || gen_random_uuid()::text),
  note_id text not null references public.notes(id) on delete cascade,
  owner_id text not null references public.profiles(id) on delete cascade,
  status public.smartnotes_ai_status not null default 'pending',
  model text,
  prompt_version text,
  attempts integer not null default 0,
  error text,
  result jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.note_embeddings (
  id text primary key default ('embedding_' || gen_random_uuid()::text),
  note_id text not null references public.notes(id) on delete cascade,
  owner_id text not null references public.profiles(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null default '',
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (note_id, chunk_index)
);

create table if not exists public.user_settings (
  id text primary key references public.profiles(id) on delete cascade,
  preset public.smartnotes_theme_preset not null default 'paper',
  lang public.smartnotes_lang not null default 'ru',
  folder_view_mode public.smartnotes_folder_view_mode not null default 'full',
  notes_per_page integer not null default 10 check (notes_per_page in (5, 10, 20, 50)),
  reduce_motion boolean not null default false,
  ui_opacity numeric(4, 2) not null default 0.88 check (ui_opacity >= 0.4 and ui_opacity <= 1),
  cards_opacity numeric(4, 2) not null default 0.92 check (cards_opacity >= 0.4 and cards_opacity <= 1),
  main_background_url text,
  sidebar_background_url text,
  custom_presets jsonb not null default '[]'::jsonb,
  editor jsonb not null default '{"toolbarVisible":true,"bold":true,"italic":true,"underline":true,"strike":true,"bullets":true,"numbered":true,"hr":true,"alignText":true,"alignMedia":true,"clearFormat":true,"undoRedo":true,"links":true,"pages":true,"inlineTags":true}'::jsonb,
  interface jsonb not null default '{"showSavedFilters":true,"showTagFilter":true,"showUpdatedPeriodFilter":true}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists folders_owner_order_idx on public.folders(owner_id, folder_order);
create index if not exists folders_owner_visible_idx on public.folders(owner_id) where trashed_at is null;
create index if not exists notes_owner_updated_idx on public.notes(owner_id, updated_at desc);
create index if not exists notes_folder_order_idx on public.notes(folder_id, folder_order) where trashed_at is null;
create index if not exists notes_tags_idx on public.notes using gin(user_tags);
create index if not exists notes_search_idx on public.notes using gin(search_vector);
create index if not exists notes_access_idx on public.notes using gin(access);
create index if not exists note_invites_note_idx on public.note_invites(note_id);
create index if not exists note_invites_invitee_email_idx on public.note_invites(lower(invitee_email));
create index if not exists ai_jobs_status_idx on public.ai_jobs(status, scheduled_at);
create index if not exists note_embeddings_note_idx on public.note_embeddings(note_id);

create or replace function public.smartnotes_refresh_note_effective_access(target_note_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note_row public.notes%rowtype;
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
  select
    note_row.id,
    item ->> 'userId',
    coalesce((item ->> 'role')::public.smartnotes_access_role, 'viewer'::public.smartnotes_access_role),
    'note_access'
  from jsonb_array_elements(coalesce(note_row.access, '[]'::jsonb)) as item
  where item ->> 'userId' is not null
    and coalesce(item ->> 'status', 'pending') = 'accepted'
  on conflict (note_id, user_id) do update set role = excluded.role, source = excluded.source;
end;
$$;

create or replace function public.smartnotes_after_note_access_change()
returns trigger
language plpgsql
as $$
begin
  perform public.smartnotes_refresh_note_effective_access(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists folders_touch_updated_at on public.folders;
create trigger folders_touch_updated_at before update on public.folders for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists notes_derived_state on public.notes;
create trigger notes_derived_state before insert or update on public.notes for each row execute function public.smartnotes_note_derived_state();

drop trigger if exists notes_refresh_effective_access on public.notes;
create trigger notes_refresh_effective_access after insert or update of owner_id, access on public.notes for each row execute function public.smartnotes_after_note_access_change();

drop trigger if exists note_invites_touch_updated_at on public.note_invites;
create trigger note_invites_touch_updated_at before update on public.note_invites for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists ai_jobs_touch_updated_at on public.ai_jobs;
create trigger ai_jobs_touch_updated_at before update on public.ai_jobs for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists note_embeddings_touch_updated_at on public.note_embeddings;
create trigger note_embeddings_touch_updated_at before update on public.note_embeddings for each row execute function public.smartnotes_touch_updated_at();

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at before update on public.user_settings for each row execute function public.smartnotes_touch_updated_at();

create or replace function public.smartnotes_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  insert into public.user_settings (id) values (new.id::text) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists smartnotes_on_auth_user_created on auth.users;
create trigger smartnotes_on_auth_user_created after insert on auth.users for each row execute function public.smartnotes_handle_new_user();

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.note_effective_access enable row level security;
alter table public.note_invites enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.note_embeddings enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = public.smartnotes_auth_user_id());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = public.smartnotes_auth_user_id());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = public.smartnotes_auth_user_id()) with check (id = public.smartnotes_auth_user_id());

drop policy if exists folders_owner_all on public.folders;
create policy folders_owner_all on public.folders for all using (owner_id = public.smartnotes_auth_user_id()) with check (owner_id = public.smartnotes_auth_user_id());

drop policy if exists notes_owner_or_participant_select on public.notes;
create policy notes_owner_or_participant_select on public.notes for select using (public.smartnotes_is_note_participant(owner_id, access));
drop policy if exists notes_owner_insert on public.notes;
create policy notes_owner_insert on public.notes for insert with check (owner_id = public.smartnotes_auth_user_id());
drop policy if exists notes_owner_update on public.notes;
create policy notes_owner_update on public.notes for update using (owner_id = public.smartnotes_auth_user_id()) with check (owner_id = public.smartnotes_auth_user_id());
drop policy if exists notes_owner_delete on public.notes;
create policy notes_owner_delete on public.notes for delete using (owner_id = public.smartnotes_auth_user_id());

drop policy if exists note_effective_access_read_own on public.note_effective_access;
create policy note_effective_access_read_own on public.note_effective_access for select using (user_id = public.smartnotes_auth_user_id());

drop policy if exists note_invites_owner_read on public.note_invites;
create policy note_invites_owner_read on public.note_invites for select using (inviter_id = public.smartnotes_auth_user_id() or invitee_id = public.smartnotes_auth_user_id());
drop policy if exists note_invites_owner_write on public.note_invites;
create policy note_invites_owner_write on public.note_invites for all using (inviter_id = public.smartnotes_auth_user_id()) with check (inviter_id = public.smartnotes_auth_user_id());

drop policy if exists ai_jobs_owner_all on public.ai_jobs;
create policy ai_jobs_owner_all on public.ai_jobs for all using (owner_id = public.smartnotes_auth_user_id()) with check (owner_id = public.smartnotes_auth_user_id());

drop policy if exists note_embeddings_owner_all on public.note_embeddings;
create policy note_embeddings_owner_all on public.note_embeddings for all using (owner_id = public.smartnotes_auth_user_id()) with check (owner_id = public.smartnotes_auth_user_id());

drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings for all using (id = public.smartnotes_auth_user_id()) with check (id = public.smartnotes_auth_user_id());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

commit;
