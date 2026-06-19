import { create } from "zustand";

import type { AuthRuntimeConfig, AuthState, AuthStatus } from "./types";
import type { User } from "@/entities/user";

type AuthStore = AuthState & {
  setRuntimeConfig: (runtimeConfig: AuthRuntimeConfig) => void;
  setAuthState: (payload: { status: AuthStatus; user: User | null; degraded?: boolean; offline?: boolean; error?: string | null }) => void;
  setError: (error: string | null) => void;
  resetAuthState: () => void;
};

const initialState: AuthState = {
  status: "loading",
  user: null,
  initialized: false,
  degraded: false,
  offline: false,
  runtimeConfig: null,
  error: null,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,
  setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),
  setAuthState: ({ status, user, degraded = false, offline = false, error = null }) =>
    set({
      status,
      user,
      degraded,
      offline,
      error,
      initialized: true,
    }),
  setError: (error) => set({ error }),
  resetAuthState: () => set(initialState),
}));
