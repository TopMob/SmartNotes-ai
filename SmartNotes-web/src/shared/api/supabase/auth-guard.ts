import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { requireSupabasePublishableKey, requireSupabaseUrl } from './env';
import { cache } from 'react';

// Cache the validation to prevent duplicate DB checks during a single request lifecycle
export const requireServerAuthorization = cache(async () => {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return { user };
});

/** Server-side admin allowlist from the `ADMIN_EMAILS` env (comma-separated). */
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Authorizes the request AND verifies the user is an admin (their verified email
 * is in `ADMIN_EMAILS`). Throws `Forbidden` for authenticated non-admins so the
 * caller can return 403; not-logged-in users are redirected by the inner guard.
 */
export const requireAdminAuthorization = cache(async () => {
  const { user } = await requireServerAuthorization();
  const email = user.email?.trim().toLowerCase();
  const admins = getAdminEmails();

  if (!email || admins.length === 0 || !admins.includes(email)) {
    throw new Error('Forbidden');
  }

  return { user };
});
