-- Migration: Harden SECURITY DEFINER functions by emptying search_path and qualifying objects.
-- Applied to all functions that currently have `SECURITY DEFINER`.

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

CREATE OR REPLACE FUNCTION public.match_folder(query_embedding public.vector, match_threshold double precision, p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.get_or_create_system_folder(p_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
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

-- Revoke execute from unneeded roles for internal functions and triggers
REVOKE EXECUTE ON FUNCTION public.smartnotes_sync_note_effective_access_trigger() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_sync_profile_from_auth() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_handle_accepted_invite() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_refresh_note_effective_access(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_after_note_change_refresh_effective_access() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smartnotes_after_note_access_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_guest_sessions() FROM public, anon, authenticated;

-- For RPC functions, only allow authenticated users
REVOKE EXECUTE ON FUNCTION public.match_folder(public.vector, double precision, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_folder(public.vector, double precision, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_system_folder(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_system_folder(uuid) TO authenticated;
