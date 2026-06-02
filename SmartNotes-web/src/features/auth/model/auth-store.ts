import { create } from "zustand";

import type { AuthRuntimeConfig, AuthState, AuthStatus } from "./types";
import type { User } from "@/entities/user";

type AuthStore = AuthState & {
  setRuntimeConfig: (runtimeConfig: AuthRuntimeConfig) => void;
  setAuthState: (payload: { status: AuthStatus; user: User | null; degraded?: boolean; error?: string | null }) => void;
  setError: (error: string | null) => void;
  resetAuthState: () => void;
};

const initialState: AuthState = {
  status: "loading",
  user: null,
  initialized: false,
  degraded: false,
  runtimeConfig: null,
  error: null,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,
  setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),
  setAuthState: ({ status, user, degraded = false, error = null }) =>
    set({
      status,
      user,
      degraded,
      error,
      initialized: true,
    }),
  setError: (error) => set({ error }),
  resetAuthState: () => set(initialState),
}));
