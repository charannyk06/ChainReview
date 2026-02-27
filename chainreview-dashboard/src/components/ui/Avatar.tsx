import { forwardRef, useState } from "react";
import { clsx } from "clsx";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  size?: AvatarSize;
  /** User's name -- used to generate initials as fallback. */
  name?: string;
  /** Explicit image source URL. Accepts null for convenience. */
  src?: string | null;
  alt?: string;
  className?: string;
}

const sizeMap: Record<
  AvatarSize,
  { px: number; text: string; container: string }
> = {
  sm: { px: 24, text: "text-[10px]", container: "h-6 w-6" },
  md: { px: 32, text: "text-xs", container: "h-8 w-8" },
  lg: { px: 40, text: "text-sm", container: "h-10 w-10" },
  xl: { px: 64, text: "text-lg", container: "h-16 w-16" },
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

/** Deterministic color from a name string. */
function initialsColor(name?: string | null): string {
  const colors = [
    "bg-brand-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-sky-600",
    "bg-rose-600",
    "bg-violet-600",
    "bg-teal-600",
    "bg-orange-600",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ size = "md", name, src, className, alt }, ref) => {
    const [imgError, setImgError] = useState(false);
    const { container, text, px } = sizeMap[size];
    const showImage = !!src && !imgError;

    return (
      <span
        ref={ref}
        className={clsx(
          "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden",
          container,
          !showImage && initialsColor(name),
          className,
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name ?? "Avatar"}
            width={px}
            height={px}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={clsx(
              "font-medium text-white select-none leading-none",
              text,
            )}
          >
            {getInitials(name)}
          </span>
        )}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";
