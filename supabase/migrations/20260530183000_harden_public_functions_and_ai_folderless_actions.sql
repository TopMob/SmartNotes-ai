-- Harden public functions exposed through the Data API.
-- Keep EXECUTE only for RPCs the app intentionally calls.

alter function public.clear_guest_sessions()
  set search_path = pg_catalog, auth;

alter function public.get_or_create_system_folder(uuid)
  set search_path = pg_catalog, public;

alter function public.match_folder(public.vector, double precision, uuid)
  set search_path = pg_catalog, public;

alter function public.match_note_embeddings(public.vector, double precision, integer, uuid)
  set search_path = pg_catalog, public;

alter function public.set_user_google_integrations_updated_at()
  set search_path = pg_catalog, public;

alter function public.smartnotes_after_note_access_change()
  set search_path = pg_catalog, public;

alter function public.smartnotes_after_note_change_refresh_effective_access()
  set search_path = pg_catalog, public;

alter function public.smartnotes_auth_user_id()
  set search_path = pg_catalog, auth;

alter function public.smartnotes_build_note_search_vector(text, text, text[])
  set search_path = pg_catalog;

alter function public.smartnotes_handle_accepted_invite()
  set search_path = pg_catalog, public;

alter function public.smartnotes_handle_new_user()
  set search_path = pg_catalog, public;

alter function public.smartnotes_is_note_participant(uuid, jsonb)
  set search_path = pg_catalog, auth;

alter function public.smartnotes_note_derived_state()
  set search_path = pg_catalog;

alter function public.smartnotes_refresh_note_effective_access(uuid)
  set search_path = pg_catalog, public;

alter function public.smartnotes_strip_html(text)
  set search_path = pg_catalog;

alter function public.smartnotes_sync_note_effective_access_trigger()
  set search_path = pg_catalog, public;

alter function public.smartnotes_sync_profile_from_auth()
  set search_path = pg_catalog, public;

alter function public.smartnotes_touch_updated_at()
  set search_path = pg_catalog;

revoke execute on function public.clear_guest_sessions() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.smartnotes_handle_accepted_invite() from public, anon, authenticated;
revoke execute on function public.smartnotes_handle_new_user() from public, anon, authenticated;
revoke execute on function public.smartnotes_refresh_note_effective_access(uuid) from public, anon, authenticated;
revoke execute on function public.smartnotes_sync_note_effective_access_trigger() from public, anon, authenticated;
revoke execute on function public.smartnotes_sync_profile_from_auth() from public, anon, authenticated;

-- These two RPCs are intentionally callable from the app.
grant execute on function public.get_or_create_system_folder(uuid) to authenticated;
grant execute on function public.match_folder(public.vector, double precision, uuid) to authenticated;
revoke execute on function public.get_or_create_system_folder(uuid) from public, anon;
revoke execute on function public.match_folder(public.vector, double precision, uuid) from public, anon;
