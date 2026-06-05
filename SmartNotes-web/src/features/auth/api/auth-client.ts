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
    throw new Error("Supabase runtime config не задан. Email-вход недоступен в локальном режиме.");
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
    throw new Error("Supabase runtime config не задан. Регистрация недоступна в локальном режиме.");
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

export async function signInWithGoogle(requestDriveAccess: boolean = false, nextPath: string = "/") {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase runtime config не задан. Google-вход недоступен в локальном режиме.");
  }

  const baseRedirect = getAuthRedirectTo();
  const redirectTo = baseRedirect ? `${baseRedirect}?next=${encodeURIComponent(nextPath)}` : undefined;

  const options: any = {
    redirectTo,
  };

  if (requestDriveAccess) {
    options.scopes = "https://www.googleapis.com/auth/drive.file";
    options.queryParams = {
      access_type: "offline",
      prompt: "consent",
    };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithGoogleIdToken(credential: string, nonce?: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase runtime config не задан. Google One Tap недоступен в локальном режиме.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCurrentProfile(payload: { displayName?: string; photoURL?: string | null }) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return false;
  }

  const data = {
    ...(payload.displayName === undefined ? null : { name: payload.displayName.slice(0, 80) }),
    ...(payload.photoURL === undefined ? null : { avatar_url: payload.photoURL }),
  };

  const { error } = await supabase.auth.updateUser({ data });

  if (error) {
    throw error;
  }

  return true;
}

export async function sendPasswordReset(email: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase runtime config не задан. Сброс пароля недоступен в локальном режиме.");
  }

  const redirectBase = getAuthRedirectTo();
  const redirectTo = redirectBase ? `${redirectBase}?next=/reset-password` : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
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

export async function exchangeCodeForSession(code: string) {
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
