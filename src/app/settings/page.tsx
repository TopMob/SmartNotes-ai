import { cookies } from "next/headers";
import SettingsClient from "./SettingsClient";

export const runtime = "nodejs";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const isDriveConnected = cookieStore.has("sb-provider-refresh-token");

  return <SettingsClient initialDriveConnected={isDriveConnected} />;
}
