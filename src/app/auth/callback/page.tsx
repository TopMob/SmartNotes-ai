import { Suspense } from "react";

import { AuthCallbackClient } from "@/features/auth/ui/auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackClient />
    </Suspense>
  );
}
