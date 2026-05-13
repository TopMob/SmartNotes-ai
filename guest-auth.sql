-- Create function to clear guest sessions by looking at the email format
CREATE OR REPLACE FUNCTION public.clear_guest_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.users
    WHERE email LIKE 'guest_%@smartnotes.app'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
