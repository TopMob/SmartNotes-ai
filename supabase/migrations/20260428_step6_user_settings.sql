create table if not exists public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  preset text not null default 'paper' check (preset in ('paper', 'smarthub', 'smartlib', 'cyber', 'lego', 'classic')),
  lang text not null default 'ru' check (lang in ('ru', 'en')),
  folder_view_mode text not null default 'full' check (folder_view_mode in ('compact', 'full')),
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

create index if not exists user_settings_updated_at_idx on public.user_settings (updated_at desc);

create or replace function public.touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_user_settings_updated_at on public.user_settings;

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.touch_user_settings_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
on public.user_settings
for select
using (auth.uid() = id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings
for update
using (auth.uid() = id)
with check (auth.uid() = id);
