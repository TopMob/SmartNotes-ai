drop policy if exists profiles_select_invited on public.profiles;
create policy profiles_select_invited on public.profiles for select using (exists (select 1 from note_invites ni where (ni.inviter_id = profiles.id or ni.invitee_id = profiles.id) and (ni.inviter_id = (select auth.uid()) or ni.invitee_id = (select auth.uid()) or ni.invitee_email = ((select auth.jwt()) ->> 'email')) and ni.status = 'pending'::smartnotes_invite_status));

drop policy if exists notes_select_invited on public.notes;
create policy notes_select_invited on public.notes for select using (exists (select 1 from note_invites ni where ni.note_id = notes.id and (ni.invitee_id = (select auth.uid()) or ni.invitee_email = ((select auth.jwt()) ->> 'email')) and ni.status = 'pending'::smartnotes_invite_status));

drop policy if exists "Users can view invites sent to them or created by them" on public.note_invites;
create policy "Users can view invites sent to them or created by them" on public.note_invites for select using (((select auth.uid()) = inviter_id) or ((select auth.uid()) = invitee_id) or (invitee_email = ((select auth.jwt()) ->> 'email')));

drop policy if exists "Users can update invites they are involved in" on public.note_invites;
create policy "Users can update invites they are involved in" on public.note_invites for update using (((select auth.uid()) = inviter_id) or ((select auth.uid()) = invitee_id) or (invitee_email = ((select auth.jwt()) ->> 'email')));
