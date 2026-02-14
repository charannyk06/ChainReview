import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   ChainReview — Unified Button Component

   Variants:  primary | secondary | ghost | purple | blue | emerald |
              orange | red | indigo
   Sizes:     xs | sm | md
   ═══════════════════════════════════════════════════════════════ */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "purple"
  | "blue"
  | "emerald"
  | "orange"
  | "red"
  | "indigo";

export type ButtonSize = "xs" | "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", icon, iconRight, children, className, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn("cr-btn", `cr-btn-${variant}`, `cr-btn-${size}`, className)}
        {...props}
      >
        {icon}
        {children}
        {iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";
