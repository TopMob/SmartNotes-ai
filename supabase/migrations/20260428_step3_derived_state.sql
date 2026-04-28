create or replace function public.smartnotes_strip_html(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(value, ''), '<[^>]*>', ' ', 'g');
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

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_smartnotes_note_derived_state on public.notes;

create trigger trg_smartnotes_note_derived_state
before insert or update of title, pages, user_tags, folder_id
on public.notes
for each row
execute function public.smartnotes_note_derived_state();
