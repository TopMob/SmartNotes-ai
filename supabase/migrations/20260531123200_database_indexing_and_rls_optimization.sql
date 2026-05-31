create index if not exists note_embeddings_owner_id_idx on public.note_embeddings (owner_id);
create index if not exists ai_jobs_note_id_idx on public.ai_jobs (note_id);
create index if not exists ai_jobs_owner_id_idx on public.ai_jobs (owner_id);
create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists note_access_granted_by_idx on public.note_access (granted_by);
create index if not exists note_access_user_id_idx on public.note_access (user_id);
create index if not exists note_invites_invitee_id_idx on public.note_invites (invitee_id);
create index if not exists note_invites_inviter_id_idx on public.note_invites (inviter_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists profiles_select_collaborator on public.profiles;
create policy profiles_select_collaborator on public.profiles for select using (exists (select 1 from note_effective_access nea1 join note_effective_access nea2 on nea1.note_id = nea2.note_id where nea1.user_id = (select auth.uid()) and nea2.user_id = profiles.id));

drop policy if exists profiles_select_invited on public.profiles;
create policy profiles_select_invited on public.profiles for select using (exists (select 1 from note_invites ni where (ni.inviter_id = profiles.id or ni.invitee_id = profiles.id) and (ni.inviter_id = (select auth.uid()) or ni.invitee_id = (select auth.uid()) or ni.invitee_email = (select auth.jwt() ->> 'email')) and ni.status = 'pending'::smartnotes_invite_status));

drop policy if exists folders_owner_all on public.folders;
create policy folders_owner_all on public.folders for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists note_invites_owner_write on public.note_invites;
create policy note_invites_owner_write on public.note_invites for all using (inviter_id = (select auth.uid())) with check (inviter_id = (select auth.uid()));

drop policy if exists note_invites_read on public.note_invites;
create policy note_invites_read on public.note_invites for select using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));

drop policy if exists "Owners can create invites" on public.note_invites;
create policy "Owners can create invites" on public.note_invites for insert with check (((select auth.uid()) = inviter_id) and (exists (select 1 from notes where notes.id = note_invites.note_id and notes.owner_id = (select auth.uid()))));

drop policy if exists "Owners can delete invites" on public.note_invites;
create policy "Owners can delete invites" on public.note_invites for delete using ((select auth.uid()) = inviter_id);

drop policy if exists "Users can view invites sent to them or created by them" on public.note_invites;
create policy "Users can view invites sent to them or created by them" on public.note_invites for select using (((select auth.uid()) = inviter_id) or ((select auth.uid()) = invitee_id) or (invitee_email = (select auth.jwt() ->> 'email')));

drop policy if exists "Users can update invites they are involved in" on public.note_invites;
create policy "Users can update invites they are involved in" on public.note_invites for update using (((select auth.uid()) = inviter_id) or ((select auth.uid()) = invitee_id) or (invitee_email = (select auth.jwt() ->> 'email')));

drop policy if exists note_effective_access_read_own on public.note_effective_access;
create policy note_effective_access_read_own on public.note_effective_access for select using (user_id = (select auth.uid()));

drop policy if exists ai_jobs_owner_all on public.ai_jobs;
create policy ai_jobs_owner_all on public.ai_jobs for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists note_embeddings_owner_all on public.note_embeddings;
create policy note_embeddings_owner_all on public.note_embeddings for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert with check (user_id is null or user_id = (select auth.uid()));

drop policy if exists notes_owner_or_participant_select on public.notes;
create policy notes_owner_or_participant_select on public.notes for select using (exists (select 1 from note_effective_access nea where nea.note_id = notes.id and nea.user_id = (select auth.uid())));

drop policy if exists notes_owner_insert on public.notes;
create policy notes_owner_insert on public.notes for insert with check (owner_id = (select auth.uid()));

drop policy if exists notes_owner_update on public.notes;
create policy notes_owner_update on public.notes for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists notes_owner_delete on public.notes;
create policy notes_owner_delete on public.notes for delete using (owner_id = (select auth.uid()));

drop policy if exists notes_editor_update on public.notes;
create policy notes_editor_update on public.notes for update using (exists (select 1 from note_effective_access nea where nea.note_id = notes.id and nea.user_id = (select auth.uid()) and nea.role = 'editor'::smartnotes_access_role)) with check (exists (select 1 from note_effective_access nea where nea.note_id = notes.id and nea.user_id = (select auth.uid()) and nea.role = 'editor'::smartnotes_access_role));

drop policy if exists notes_select_invited on public.notes;
create policy notes_select_invited on public.notes for select using (exists (select 1 from note_invites ni where ni.note_id = notes.id and (ni.invitee_id = (select auth.uid()) or ni.invitee_email = (select auth.jwt() ->> 'email')) and ni.status = 'pending'::smartnotes_invite_status));

drop policy if exists note_pages_note_select on public.note_pages;
create policy note_pages_note_select on public.note_pages for select using (exists (select 1 from note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = (select auth.uid())));

drop policy if exists note_pages_note_insert on public.note_pages;
create policy note_pages_note_insert on public.note_pages for insert with check (exists (select 1 from note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

drop policy if exists note_pages_note_update on public.note_pages;
create policy note_pages_note_update on public.note_pages for update using (exists (select 1 from note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role]))) with check (exists (select 1 from note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

drop policy if exists note_pages_note_delete on public.note_pages;
create policy note_pages_note_delete on public.note_pages for delete using (exists (select 1 from note_effective_access nea where nea.note_id = note_pages.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

drop policy if exists note_media_note_select on public.note_media;
create policy note_media_note_select on public.note_media for select using (exists (select 1 from note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = (select auth.uid())));

drop policy if exists note_media_note_write on public.note_media;
create policy note_media_note_write on public.note_media for all using (exists (select 1 from note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role]))) with check (exists (select 1 from note_effective_access nea where nea.note_id = note_media.note_id and nea.user_id = (select auth.uid()) and nea.role = any (array['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])));

drop policy if exists note_access_owner_all on public.note_access;
create policy note_access_owner_all on public.note_access for all using (exists (select 1 from notes n where n.id = note_access.note_id and n.owner_id = (select auth.uid()))) with check (exists (select 1 from notes n where n.id = note_access.note_id and n.owner_id = (select auth.uid()) and note_access.user_id <> n.owner_id));

drop policy if exists note_access_user_read on public.note_access;
create policy note_access_user_read on public.note_access for select using (user_id = (select auth.uid()));

drop policy if exists "Users can read own Google integration" on public.user_google_integrations;
create policy "Users can read own Google integration" on public.user_google_integrations for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own Google integration" on public.user_google_integrations;
create policy "Users can insert own Google integration" on public.user_google_integrations for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own Google integration" on public.user_google_integrations;
create policy "Users can update own Google integration" on public.user_google_integrations for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own Google integration" on public.user_google_integrations;
create policy "Users can delete own Google integration" on public.user_google_integrations for delete using ((select auth.uid()) = user_id);
