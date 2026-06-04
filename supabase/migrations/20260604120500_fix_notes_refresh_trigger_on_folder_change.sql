DROP TRIGGER IF EXISTS notes_refresh_effective_access ON public.notes;
CREATE TRIGGER notes_refresh_effective_access
  AFTER INSERT OR UPDATE OF owner_id, folder_id ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.smartnotes_after_note_change_refresh_effective_access();
