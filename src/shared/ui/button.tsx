import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
        variant === "primary" && "bg-accent text-accent-foreground shadow-lg shadow-violet-900/15 hover:brightness-105",
        variant === "secondary" && "border border-border bg-surface-strong text-foreground hover:bg-background",
        variant === "ghost" && "text-foreground/70 hover:bg-surface",
        className,
      )}
      {...props}
    />
  );
}
