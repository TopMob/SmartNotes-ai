import { useAuthStore } from "@/features/auth/model/auth-store";

export function getLocalUserScope() {
  return useAuthStore.getState().user?.id ?? "local-user";
}
