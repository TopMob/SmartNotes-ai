CREATE OR REPLACE FUNCTION public.match_folder(query_embedding vector, match_threshold double precision, p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_folder_id uuid;
BEGIN
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE owner_id = p_owner_id
    AND is_hidden = false
    AND trashed_at IS NULL
    AND embedding IS NOT NULL
    AND (is_system = false OR is_system IS NULL)
    AND (1 - (embedding <=> query_embedding)) > match_threshold
  ORDER BY embedding <=> query_embedding ASC
  LIMIT 1;

  RETURN v_folder_id;
END;
$function$;
