import { SmartNotesShell } from "@/features/app-shell/ui/smart-notes-shell";
import { ShellErrorBoundary } from "@/shared/ui/error-boundary";

export default function HomePage() {
  return (
    <ShellErrorBoundary>
      <SmartNotesShell />
    </ShellErrorBoundary>
  );
}
