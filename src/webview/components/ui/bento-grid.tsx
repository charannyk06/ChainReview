"use client";

import { cn } from "@/lib/utils";

export interface BentoGridProps {
  className?: string;
  children?: React.ReactNode;
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface BentoGridItemProps {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
  children,
}: BentoGridItemProps) {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition duration-200 hover:shadow-xl hover:shadow-neutral-900/50",
        className
      )}
    >
      {header && <div className="overflow-hidden rounded-lg">{header}</div>}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          {title && (
            <div className="text-sm font-bold text-neutral-200">{title}</div>
          )}
        </div>
        {description && (
          <div className="text-xs font-normal text-neutral-400 line-clamp-2">
            {description}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
