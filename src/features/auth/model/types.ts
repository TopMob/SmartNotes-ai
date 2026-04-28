import type { User } from "@/entities/user";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "degraded";

export type AuthRuntimeConfig = {
  url: string | null;
  publishableKey: string | null;
};

export type AuthState = {
  status: AuthStatus;
  user: User | null;
  initialized: boolean;
  degraded: boolean;
  runtimeConfig: AuthRuntimeConfig | null;
  error: string | null;
};
