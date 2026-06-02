-- Migration: Optimize RLS policies and resolve all performance/linter warnings.
-- 1. Wrap all auth.uid() and auth.jwt() references in subqueries to avoid re-evaluation.
-- 2. Unify overlapping SELECT and UPDATE permissive policies on public.note_media, public.notes, and public.profiles.

-- -----------------------------------------------------------------------------
-- 1. public.note_access (wrapping auth.uid() in subqueries)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS note_access_select ON public.note_access;
DROP POLICY IF EXISTS note_access_insert ON public.note_access;
DROP POLICY IF EXISTS note_access_update ON public.note_access;
DROP POLICY IF EXISTS note_access_delete ON public.note_access;

CREATE POLICY note_access_select ON public.note_access FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY note_access_insert ON public.note_access FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid())
    ) AND note_access.user_id <> (SELECT auth.uid())
  );

CREATE POLICY note_access_update ON public.note_access FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY note_access_delete ON public.note_access FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_access.note_id AND n.owner_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 2. public.note_invites (wrapping auth.uid() and auth.jwt() in subqueries)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS note_invites_select ON public.note_invites;
DROP POLICY IF EXISTS note_invites_insert ON public.note_invites;
DROP POLICY IF EXISTS note_invites_update ON public.note_invites;
DROP POLICY IF EXISTS note_invites_delete ON public.note_invites;

CREATE POLICY note_invites_select ON public.note_invites FOR SELECT TO authenticated
  USING (
    inviter_id = (SELECT auth.uid()) OR
    invitee_id = (SELECT auth.uid()) OR
    invitee_email = ((SELECT auth.jwt()) ->> 'email')
  );

CREATE POLICY note_invites_insert ON public.note_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_invites.note_id AND notes.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY note_invites_update ON public.note_invites FOR UPDATE TO authenticated
  USING (
    inviter_id = (SELECT auth.uid()) OR
    invitee_id = (SELECT auth.uid()) OR
    invitee_email = ((SELECT auth.jwt()) ->> 'email')
  ) WITH CHECK (
    inviter_id = (SELECT auth.uid()) OR
    invitee_id = (SELECT auth.uid()) OR
    invitee_email = ((SELECT auth.jwt()) ->> 'email')
  );

CREATE POLICY note_invites_delete ON public.note_invites FOR DELETE TO authenticated
  USING (
    inviter_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. public.note_media (remove overlapping note_media_note_select and note_media_note_write)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS note_media_note_select ON public.note_media;
DROP POLICY IF EXISTS note_media_note_write ON public.note_media;
DROP POLICY IF EXISTS note_media_select ON public.note_media;
DROP POLICY IF EXISTS note_media_insert ON public.note_media;
DROP POLICY IF EXISTS note_media_update ON public.note_media;
DROP POLICY IF EXISTS note_media_delete ON public.note_media;

CREATE POLICY note_media_select ON public.note_media FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = note_media.note_id AND nea.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY note_media_insert ON public.note_media FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = note_media.note_id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])
    )
  );

CREATE POLICY note_media_update ON public.note_media FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = note_media.note_id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = note_media.note_id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])
    )
  );

CREATE POLICY note_media_delete ON public.note_media FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = note_media.note_id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = ANY (ARRAY['owner'::smartnotes_access_role, 'editor'::smartnotes_access_role])
    )
  );

-- -----------------------------------------------------------------------------
-- 4. public.notes (unify notes_owner_or_participant_select + notes_select_invited into notes_select,
--                 and unify notes_owner_update + notes_editor_update into notes_update)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS notes_owner_or_participant_select ON public.notes;
DROP POLICY IF EXISTS notes_select_invited ON public.notes;
DROP POLICY IF EXISTS notes_select ON public.notes;

DROP POLICY IF EXISTS notes_owner_update ON public.notes;
DROP POLICY IF EXISTS notes_editor_update ON public.notes;
DROP POLICY IF EXISTS notes_update ON public.notes;

-- Re-wrap owner_id checks and delete policy to use (SELECT auth.uid()) to avoid warnings
DROP POLICY IF EXISTS notes_owner_insert ON public.notes;
DROP POLICY IF EXISTS notes_owner_delete ON public.notes;
DROP POLICY IF EXISTS notes_insert ON public.notes;
DROP POLICY IF EXISTS notes_delete ON public.notes;

CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = notes.id AND nea.user_id = (SELECT auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.note_invites ni
      WHERE ni.note_id = notes.id
        AND (ni.invitee_id = (SELECT auth.uid()) OR ni.invitee_email = ((SELECT auth.jwt()) ->> 'email'))
        AND ni.status = 'pending'::smartnotes_invite_status
    )
  );

CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
  );

CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = notes.id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = 'editor'::smartnotes_access_role
    )
  ) WITH CHECK (
    owner_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea
      WHERE nea.note_id = notes.id
        AND nea.user_id = (SELECT auth.uid())
        AND nea.role = 'editor'::smartnotes_access_role
    )
  );

CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 5. public.profiles (unify profiles_select_own + profiles_select_collaborator + profiles_select_invited into profiles_select)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_collaborator ON public.profiles;
DROP POLICY IF EXISTS profiles_select_invited ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.note_effective_access nea1
      JOIN public.note_effective_access nea2 ON nea1.note_id = nea2.note_id
      WHERE nea1.user_id = (SELECT auth.uid()) AND nea2.user_id = profiles.id
    ) OR
    EXISTS (
      SELECT 1 FROM public.note_invites ni
      WHERE (ni.inviter_id = profiles.id OR ni.invitee_id = profiles.id)
        AND (ni.inviter_id = (SELECT auth.uid()) OR ni.invitee_id = (SELECT auth.uid()) OR ni.invitee_email = ((SELECT auth.jwt()) ->> 'email'))
        AND ni.status = 'pending'::smartnotes_invite_status
    )
  );
