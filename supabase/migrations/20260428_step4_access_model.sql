create table if not exists public.note_effective_access (
  note_id uuid not null,
  user_id uuid not null,
  role text not null,
  source text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (note_id, user_id)
);

create index if not exists idx_note_effective_access_user_id on public.note_effective_access(user_id);
create index if not exists idx_note_effective_access_note_id on public.note_effective_access(note_id);

alter table public.note_effective_access enable row level security;

drop policy if exists note_effective_access_read on public.note_effective_access;
create policy note_effective_access_read on public.note_effective_access
for select
using (auth.uid() = user_id);
