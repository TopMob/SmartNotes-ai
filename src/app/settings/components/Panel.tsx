import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
};

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface-strong p-3 text-left sm:rounded-[1.4rem] sm:p-4">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}
