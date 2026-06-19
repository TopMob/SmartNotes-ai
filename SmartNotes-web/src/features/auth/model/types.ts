import type { User } from "@/entities/user";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "degraded";

export type AuthRuntimeConfig = {
  url: string | null;
  publishableKey: string | null;
  googleClientId: string | null;
};

export type AuthState = {
  status: AuthStatus;
  user: User | null;
  initialized: boolean;
  degraded: boolean;
  /** True when we fell back to local mode because the backend was unreachable (vs. an intentional guest/local session). */
  offline: boolean;
  runtimeConfig: AuthRuntimeConfig | null;
  error: string | null;
};
