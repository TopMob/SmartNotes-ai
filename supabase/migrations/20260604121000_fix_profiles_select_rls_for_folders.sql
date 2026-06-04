DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  USING (
    (id = auth.uid())
    OR
    (EXISTS (
      SELECT 1 FROM public.note_effective_access nea1
      JOIN public.note_effective_access nea2 ON nea1.note_id = nea2.note_id
      WHERE nea1.user_id = auth.uid() AND nea2.user_id = profiles.id
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.folder_effective_access fea1
      JOIN public.folder_effective_access fea2 ON fea1.folder_id = fea2.folder_id
      WHERE fea1.user_id = auth.uid() AND fea2.user_id = profiles.id
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.note_invites ni
      WHERE (
        (ni.inviter_id = profiles.id AND (ni.invitee_id = auth.uid() OR ni.invitee_email = (auth.jwt() ->> 'email'::text)))
        OR
        (ni.invitee_id = profiles.id AND ni.inviter_id = auth.uid())
      )
      AND ni.status = 'pending'::smartnotes_invite_status
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.folder_invites fi
      WHERE (
        (fi.inviter_id = profiles.id AND (fi.invitee_id = auth.uid() OR fi.invitee_email = (auth.jwt() ->> 'email'::text)))
        OR
        (fi.invitee_id = profiles.id AND fi.inviter_id = auth.uid())
      )
      AND fi.status = 'pending'::smartnotes_invite_status
    ))
  );
