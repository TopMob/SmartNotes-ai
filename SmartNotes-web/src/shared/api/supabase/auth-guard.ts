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
