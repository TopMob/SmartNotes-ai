-- Harden SECURITY DEFINER functions with explicit SET search_path = ''
CREATE OR REPLACE FUNCTION public.smartnotes_sync_note_effective_access_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.smartnotes_refresh_note_effective_access(old.id);
    return old;
  end if;

  perform public.smartnotes_refresh_note_effective_access(new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.smartnotes_sync_profile_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.smartnotes_handle_accepted_invite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    -- Make sure invitee_id is set
    IF NEW.invitee_id IS NULL THEN
      RAISE EXCEPTION 'cannot accept invite without invitee_id';
    END IF;

    INSERT INTO public.note_access (note_id, user_id, role, granted_by)
    VALUES (NEW.note_id, NEW.invitee_id, NEW.role, NEW.inviter_id)
    ON CONFLICT (note_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_folder(query_embedding vector, match_threshold double precision, p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_folder_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_owner_id != auth.uid() THEN
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

CREATE OR REPLACE FUNCTION public.get_or_create_system_folder(p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_folder_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_owner_id != auth.uid() THEN
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

CREATE OR REPLACE FUNCTION public.smartnotes_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;


CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.smartnotes_refresh_note_effective_access(target_note_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

CREATE OR REPLACE FUNCTION public.smartnotes_after_note_change_refresh_effective_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform public.smartnotes_refresh_note_effective_access(coalesce(new.id, old.id)); return coalesce(new, old); end; $function$;

CREATE OR REPLACE FUNCTION public.smartnotes_after_note_access_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform public.smartnotes_refresh_note_effective_access(coalesce(new.note_id, old.note_id)); return coalesce(new, old); end; $function$;


CREATE OR REPLACE FUNCTION public.clear_guest_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    DELETE FROM auth.users
    WHERE id IN (
        SELECT id FROM auth.users
        WHERE id::text LIKE 'guest_%'
        OR email LIKE 'guest_%@smartnotes.app'
        OR raw_user_meta_data->>'is_guest' = 'true'
    )
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$function$;

-- Update existing RLS policies to enforce explicit auth.uid() IS NOT NULL check
DROP POLICY IF EXISTS folders_owner_all ON public.folders;
CREATE POLICY folders_owner_all ON public.folders FOR ALL USING (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS note_invites_owner_write ON public.note_invites;
CREATE POLICY note_invites_owner_write ON public.note_invites FOR ALL USING (auth.uid() IS NOT NULL AND inviter_id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND inviter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS note_invites_read ON public.note_invites;
CREATE POLICY note_invites_read ON public.note_invites FOR SELECT USING (auth.uid() IS NOT NULL AND (inviter_id = (SELECT auth.uid()) OR invitee_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners can create invites" ON public.note_invites;
CREATE POLICY "Owners can create invites" ON public.note_invites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = inviter_id AND EXISTS (SELECT 1 FROM notes WHERE notes.id = note_invites.note_id AND notes.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners can delete invites" ON public.note_invites;
CREATE POLICY "Owners can delete invites" ON public.note_invites FOR DELETE USING (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = inviter_id);

DROP POLICY IF EXISTS "Users can view invites sent to them or created by them" ON public.note_invites;
CREATE POLICY "Users can view invites sent to them or created by them" ON public.note_invites FOR SELECT USING (auth.uid() IS NOT NULL AND ((SELECT auth.uid()) = inviter_id OR (SELECT auth.uid()) = invitee_id OR invitee_email = (SELECT auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Users can update invites they are involved in" ON public.note_invites;
CREATE POLICY "Users can update invites they are involved in" ON public.note_invites FOR UPDATE USING (auth.uid() IS NOT NULL AND ((SELECT auth.uid()) = inviter_id OR (SELECT auth.uid()) = invitee_id OR invitee_email = (SELECT auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS note_effective_access_read_own ON public.note_effective_access;
CREATE POLICY note_effective_access_read_own ON public.note_effective_access FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_jobs_owner_all ON public.ai_jobs;
CREATE POLICY ai_jobs_owner_all ON public.ai_jobs FOR ALL USING (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS note_embeddings_owner_all ON public.note_embeddings;
CREATE POLICY note_embeddings_owner_all ON public.note_embeddings FOR ALL USING (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_settings_owner_all ON public.user_settings;
CREATE POLICY user_settings_owner_all ON public.user_settings FOR ALL USING (auth.uid() IS NOT NULL AND id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND id = (SELECT auth.uid()));

DROP POLICY IF EXISTS feedback_insert_own ON public.feedback;
CREATE POLICY feedback_insert_own ON public.feedback FOR INSERT WITH CHECK (user_id IS NULL OR (auth.uid() IS NOT NULL AND user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS notes_owner_or_participant_select ON public.notes;
CREATE POLICY notes_owner_or_participant_select ON public.notes FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = notes.id AND nea.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS notes_owner_insert ON public.notes;
CREATE POLICY notes_owner_insert ON public.notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notes_owner_update ON public.notes;
CREATE POLICY notes_owner_update ON public.notes FOR UPDATE USING (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid())) WITH CHECK (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notes_owner_delete ON public.notes;
CREATE POLICY notes_owner_delete ON public.notes FOR DELETE USING (auth.uid() IS NOT NULL AND owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notes_editor_update ON public.notes;
CREATE POLICY notes_editor_update ON public.notes FOR UPDATE USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = notes.id AND nea.user_id = (SELECT auth.uid()) AND nea.role = 'editor'::smartnotes_access_role)) WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = notes.id AND nea.user_id = (SELECT auth.uid()) AND nea.role = 'editor'::smartnotes_access_role));

DROP POLICY IF EXISTS notes_select_invited ON public.notes;
CREATE POLICY notes_select_invited ON public.notes FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_invites ni WHERE ni.note_id = notes.id AND (ni.invitee_id = (SELECT auth.uid()) OR ni.invitee_email = (SELECT auth.jwt() ->> 'email')) AND ni.status = 'pending'::smartnotes_invite_status));

DROP POLICY IF EXISTS note_pages_note_select ON public.note_pages;
CREATE POLICY note_pages_note_select ON public.note_pages FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_pages.note_id AND nea.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS note_pages_note_insert ON public.note_pages;
CREATE POLICY note_pages_note_insert ON public.note_pages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_pages.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

DROP POLICY IF EXISTS note_pages_note_update ON public.note_pages;
CREATE POLICY note_pages_note_update ON public.note_pages FOR UPDATE USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_pages.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role]))) WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_pages.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

DROP POLICY IF EXISTS note_pages_note_delete ON public.note_pages;
CREATE POLICY note_pages_note_delete ON public.note_pages FOR DELETE USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_pages.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

DROP POLICY IF EXISTS note_media_note_select ON public.note_media;
CREATE POLICY note_media_note_select ON public.note_media FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_media.note_id AND nea.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS note_media_note_write ON public.note_media;
CREATE POLICY note_media_note_write ON public.note_media FOR ALL USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_media.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role]))) WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM note_effective_access nea WHERE nea.note_id = note_media.note_id AND nea.user_id = (SELECT auth.uid()) AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

DROP POLICY IF EXISTS note_access_owner_all ON public.note_access;
CREATE POLICY note_access_owner_all ON public.note_access FOR ALL USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM notes n WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid()))) WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM notes n WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid()) AND note_access.user_id <> n.owner_id));

DROP POLICY IF EXISTS note_access_user_read ON public.note_access;
CREATE POLICY note_access_user_read ON public.note_access FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can read own Google integration" ON public.user_google_integrations;
CREATE POLICY "Users can read own Google integration" ON public.user_google_integrations FOR SELECT USING (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own Google integration" ON public.user_google_integrations;
CREATE POLICY "Users can insert own Google integration" ON public.user_google_integrations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own Google integration" ON public.user_google_integrations;
CREATE POLICY "Users can update own Google integration" ON public.user_google_integrations FOR UPDATE USING (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = user_id) WITH CHECK (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own Google integration" ON public.user_google_integrations;
CREATE POLICY "Users can delete own Google integration" ON public.user_google_integrations FOR DELETE USING (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = user_id);


-- Create semantic deduplication function
CREATE OR REPLACE FUNCTION public.insert_unique_embedding(
  p_tenant_id UUID,
  p_content TEXT,
  p_embedding VECTOR(384),
  p_similarity_threshold FLOAT DEFAULT 0.98
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  duplicate_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.note_embeddings
    WHERE owner_id = p_tenant_id
    AND embedding <=> p_embedding < (1.0 - p_similarity_threshold)
  ) INTO duplicate_exists;

  IF duplicate_exists THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.note_embeddings (owner_id, content, embedding)
  VALUES (p_tenant_id, p_content, p_embedding);

  RETURN TRUE;
END;
$$;
