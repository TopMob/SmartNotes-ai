import type { Metadata } from "next";

import { LoginShell } from "@/features/auth/ui/login-shell";

export const metadata: Metadata = {
  title: "SmartNotes - Вход",
};

export default function LoginPage() {
  return <LoginShell />;
}
