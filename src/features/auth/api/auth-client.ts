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

  if (!supabase) {
    throw new Error("Supabase auth is unavailable in local mode.");
  }

  const { data, error } = await supabase.auth.signInWithPassword(payload);

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithEmail(payload: EmailAuthPayload) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase auth is unavailable in local mode.");
  }

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

  if (!supabase) {
    throw new Error("Google sign-in is unavailable in local mode.");
  }

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

  if (!supabase) {
    throw new Error("Password reset is unavailable in local mode.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectTo(),
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function exchangeCodeForSession(code: string): Promise<Session | null> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  return data.session;
}

/**
 * Exchange a Google One Tap credential (JWT) for a Supabase session.
 * Called from the GSI prompt callback after the user accepts One Tap.
 */
export async function signInWithGoogleOneTap(credential: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Google One Tap sign-in is unavailable in local mode.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
  });

  if (error) {
    throw error;
  }
}
