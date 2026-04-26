import { Children, cloneElement, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement } from "react";

import { cn } from "@/shared/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ asChild = false, className, variant = "primary", ...props }: ButtonProps) {
  const buttonClassName = cn(
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
    variant === "primary" && "bg-accent text-accent-foreground shadow-lg shadow-violet-900/15 hover:brightness-105",
    variant === "secondary" && "border border-border bg-surface-strong text-foreground hover:bg-background",
    variant === "ghost" && "text-foreground/70 hover:bg-surface",
    className,
  );

  if (asChild) {
    const child = Children.only(props.children);

    if (!isValidElement<{ className?: string }>(child)) {
      return null;
    }

    return cloneElement(child as ReactElement<{ className?: string }>, {
      className: cn(buttonClassName, child.props.className),
    });
  }

  return (
    <button
      className={buttonClassName}
      {...props}
    />
  );
}
