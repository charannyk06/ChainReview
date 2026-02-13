"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface MovingBorderProps {
  children: React.ReactNode;
  duration?: number;
  className?: string;
  containerClassName?: string;
  borderClassName?: string;
  borderRadius?: string;
  as?: React.ElementType;
  offset?: number;
}

export function MovingBorder({
  children,
  duration = 4,
  className,
  containerClassName,
  borderClassName,
  borderRadius = "1rem",
  as: Component = "div",
  offset = 0,
}: MovingBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <Component
      ref={containerRef}
      className={cn(
        "relative overflow-hidden p-[1px]",
        containerClassName
      )}
      style={{ borderRadius }}
    >
      {/* SVG border animation */}
      <div
        className="absolute inset-0"
        style={{ borderRadius }}
      >
        <svg
          className="absolute h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <motion.radialGradient
              id={`moving-border-gradient-${offset}`}
              cx="50%"
              cy="50%"
              r="50%"
              animate={{
                cx: ["0%", "100%", "100%", "0%", "0%"],
                cy: ["0%", "0%", "100%", "100%", "0%"],
              }}
              transition={{
                duration,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <stop offset="0%" stopColor="rgb(59, 130, 246)" />
              <stop offset="50%" stopColor="rgb(139, 92, 246)" />
              <stop offset="100%" stopColor="transparent" />
            </motion.radialGradient>
          </defs>
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="none"
            stroke={`url(#moving-border-gradient-${offset})`}
            strokeWidth="4"
            rx="15"
            ry="15"
          />
        </svg>
      </div>

      {/* Conic gradient moving border (CSS approach) */}
      <motion.div
        className={cn(
          "absolute inset-0",
          borderClassName
        )}
        style={{
          borderRadius,
          background:
            "conic-gradient(from 0deg, transparent 60%, #3b82f6, #8b5cf6, transparent 100%)",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Inner content area */}
      <div
        className={cn(
          "relative z-10 bg-neutral-950",
          className
        )}
        style={{ borderRadius }}
      >
        {children}
      </div>
    </Component>
  );
}
