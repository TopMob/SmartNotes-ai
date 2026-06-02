import React from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

type AccessBadgeProps = {
  role: "owner" | "editor" | "viewer";
};

export function AccessBadge({ role }: AccessBadgeProps) {
  const isOwner = role === "owner";
  const isEditor = role === "editor";

  let icon = <Shield className="h-3.5 w-3.5" />;
  let label = "Читатель";
  let classes = "bg-foreground/6 border-foreground/12 text-foreground/64";

  if (isOwner) {
    icon = <ShieldAlert className="h-3.5 w-3.5 text-violet-400" />;
    label = "Владелец";
    classes = "bg-violet-500/10 border-violet-500/20 text-violet-300";
  } else if (isEditor) {
    icon = <ShieldCheck className="h-3.5 w-3.5 text-accent" />;
    label = "Редактор";
    classes = "bg-accent/10 border-accent/20 text-accent";
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold shrink-0 ${classes}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}