-- Create function to clear guest sessions
CREATE OR REPLACE FUNCTION auth.clear_guest_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.users
    WHERE id::text LIKE 'guest_%'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule job to run every minute
SELECT cron.schedule('clear_guest_sessions_job', '* * * * *', 'SELECT auth.clear_guest_sessions()');
