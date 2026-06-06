-- Fix note updated_at trigger: do not update updated_at when only pinned or favorite status changes.
CREATE OR REPLACE FUNCTION public.smartnotes_note_derived_state()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
begin
  if coalesce(new.title,'') = '' or new.title = 'Untitled note' then
    new.title := coalesce(nullif(left(trim(coalesce(new.content,'')),80),''), 'Untitled note');
  end if;
  
  if TG_OP = 'INSERT' then
    new.updated_at := timezone('utc', now());
  elsif TG_OP = 'UPDATE' then
    if new.updated_at = old.updated_at then
      if new.title is distinct from old.title or
         new.content is distinct from old.content or
         new.user_tags is distinct from old.user_tags or
         new.folder_id is distinct from old.folder_id then
        new.updated_at := timezone('utc', now());
      end if;
    end if;
  end if;
  
  return new;
end;
$function$;

ALTER FUNCTION public.smartnotes_note_derived_state() SET search_path = pg_catalog;
