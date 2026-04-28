import type { Session } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

type EmailAuthPayload = {
  email: string;
  password: string;
};

function getAuthRedirectTo() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/auth/callback`;
}

export async function signInWithEmail(payload: EmailAuthPayload) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword(payload);

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithEmail(payload: EmailAuthPayload) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    ...payload,
    options: {
      emailRedirectTo: getAuthRedirectTo(),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithGoogle() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectTo(),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function sendPasswordReset(email: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectTo(),
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function exchangeCodeForSession(code: string): Promise<Session | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  return data.session;
}
