import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

type CardVariant = "default" | "bordered" | "elevated";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl",
  bordered:
    "bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl",
  elevated:
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-md dark:shadow-zinc-900/40",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(variantStyles[variant], className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

/* ------------------------------------------------------------------ */
/*  CardHeader                                                         */
/* ------------------------------------------------------------------ */

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a bottom border between header and content. */
  bordered?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, bordered = false, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "px-6 py-4",
        bordered && "border-b border-zinc-200 dark:border-zinc-800",
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

/* ------------------------------------------------------------------ */
/*  CardTitle                                                          */
/* ------------------------------------------------------------------ */

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={clsx(
      "text-base font-semibold text-zinc-900 dark:text-white leading-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/* ------------------------------------------------------------------ */
/*  CardDescription                                                    */
/* ------------------------------------------------------------------ */

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={clsx(
      "text-sm text-zinc-500 dark:text-zinc-400 mt-1",
      className,
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/* ------------------------------------------------------------------ */
/*  CardContent                                                        */
/* ------------------------------------------------------------------ */

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx("px-6 py-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

/* ------------------------------------------------------------------ */
/*  CardFooter                                                         */
/* ------------------------------------------------------------------ */

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, bordered = true, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "px-6 py-4",
        bordered && "border-t border-zinc-200 dark:border-zinc-800",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";
