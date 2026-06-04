ALTER TABLE public.note_effective_access DROP CONSTRAINT IF EXISTS note_effective_access_source_check;
ALTER TABLE public.note_effective_access ADD CONSTRAINT note_effective_access_source_check CHECK (source = ANY (ARRAY['owner'::text, 'note_access'::text, 'folder_access'::text]));
