-- Migration: Harden Database RLS and Relocate Extensions to Dedicated Schema.
-- Resolves linter warnings for Multiple Permissive Policies and Extensions in Public schema.

-- -----------------------------------------------------------------------------
-- 1. Relocate Extensions and Recreate Dependent Functions
-- -----------------------------------------------------------------------------

-- Drop dependent functions first so Postgres allows schema change on type public.vector
DROP FUNCTION IF EXISTS public.match_folder(public.vector, double precision, uuid);
DROP FUNCTION IF EXISTS public.match_note_embeddings(public.vector, double precision, integer, uuid);

-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension (vector supports SET SCHEMA)
ALTER EXTENSION vector SET SCHEMA extensions;

-- Recreate pg_net extension in extensions schema (pg_net does not support SET SCHEMA)
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net SCHEMA extensions;

-- Recreate public.match_folder using extensions.vector and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.match_folder(query_embedding extensions.vector, match_threshold double precision, p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_folder_id uuid;
BEGIN
  IF p_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

-- Recreate public.match_note_embeddings using extensions.vector and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.match_note_embeddings(query_embedding extensions.vector, match_threshold double precision, match_count integer, p_owner_id uuid)
 RETURNS TABLE(id uuid, note_id uuid, note_title text, chunk_index integer, content text, similarity double precision)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ne.id,
    ne.note_id,
    n.title AS note_title,
    ne.chunk_index,
    ne.content,
    (1 - (ne.embedding <=> query_embedding))::double precision AS similarity
  FROM public.note_embeddings ne
  INNER JOIN public.notes n ON n.id = ne.note_id
  WHERE ne.owner_id = p_owner_id
    AND n.trashed_at IS NULL
    AND n.is_archived = false
    AND n.lock_hidden = false
    AND (1 - (ne.embedding <=> query_embedding)) > match_threshold
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Configure execute permissions for the recreated functions
REVOKE EXECUTE ON FUNCTION public.match_folder(extensions.vector, double precision, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_folder(extensions.vector, double precision, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.match_note_embeddings(extensions.vector, double precision, integer, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_note_embeddings(extensions.vector, double precision, integer, uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. Harden get_or_create_system_folder to use SECURITY INVOKER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_system_folder(p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_folder_id uuid;
BEGIN
  IF p_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Try to find existing system folder
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE owner_id = p_owner_id AND is_system = true
  LIMIT 1;

  -- If not found, insert it safely
  IF v_folder_id IS NULL THEN
    INSERT INTO public.folders (owner_id, name, is_system, folder_order, access_role, metadata)
    VALUES (p_owner_id, 'Неразобранное', true, -1, 'owner', '{}'::jsonb)
    ON CONFLICT (owner_id) WHERE (is_system = true)
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_system_folder(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_system_folder(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. Unify RLS Policies for public.note_access
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS note_access_owner_all ON public.note_access;
DROP POLICY IF EXISTS note_access_user_read ON public.note_access;

CREATE POLICY note_access_select ON public.note_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = auth.uid()
    )
  );

CREATE POLICY note_access_insert ON public.note_access FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = auth.uid()
    ) AND note_access.user_id <> auth.uid()
  );

CREATE POLICY note_access_update ON public.note_access FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = auth.uid()
    )
  );

CREATE POLICY note_access_delete ON public.note_access FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 4. Unify RLS Policies for public.note_invites
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS note_invites_owner_write ON public.note_invites;
DROP POLICY IF EXISTS note_invites_read ON public.note_invites;
DROP POLICY IF EXISTS "Owners can create invites" ON public.note_invites;
DROP POLICY IF EXISTS "Owners can delete invites" ON public.note_invites;
DROP POLICY IF EXISTS "Users can view invites sent to them or created by them" ON public.note_invites;
DROP POLICY IF EXISTS "Users can update invites they are involved in" ON public.note_invites;

CREATE POLICY note_invites_select ON public.note_invites FOR SELECT TO authenticated
  USING (
    inviter_id = auth.uid() OR
    invitee_id = auth.uid() OR
    invitee_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY note_invites_insert ON public.note_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_invites.note_id AND notes.owner_id = auth.uid()
    )
  );

CREATE POLICY note_invites_update ON public.note_invites FOR UPDATE TO authenticated
  USING (
    inviter_id = auth.uid() OR
    invitee_id = auth.uid() OR
    invitee_email = (auth.jwt() ->> 'email')
  ) WITH CHECK (
    inviter_id = auth.uid() OR
    invitee_id = auth.uid() OR
    invitee_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY note_invites_delete ON public.note_invites FOR DELETE TO authenticated
  USING (
    inviter_id = auth.uid()
  );
