"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface HoverBorderGradientProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  as?: React.ElementType;
  duration?: number;
  clockwise?: boolean;
  onClick?: () => void;
}

export function HoverBorderGradient({
  children,
  className,
  containerClassName,
  as: Component = "button",
  duration = 3,
  clockwise = true,
  onClick,
}: HoverBorderGradientProps) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const rotateTarget = clockwise ? 360 : -360;

  return (
    <Component
      ref={containerRef}
      className={cn(
        "relative inline-flex rounded-full p-[1px] overflow-hidden",
        containerClassName
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated gradient border */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e, #06b6d4)",
        }}
        animate={{
          rotate: isHovered ? rotateTarget : 0,
          opacity: isHovered ? 1 : 0.5,
        }}
        transition={{
          rotate: {
            duration,
            repeat: Infinity,
            ease: "linear",
          },
          opacity: { duration: 0.3 },
        }}
      />

      {/* Blur layer for glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full blur-sm"
        style={{
          background:
            "conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e, #06b6d4)",
        }}
        animate={{
          rotate: isHovered ? rotateTarget : 0,
          opacity: isHovered ? 0.6 : 0,
        }}
        transition={{
          rotate: {
            duration,
            repeat: Infinity,
            ease: "linear",
          },
          opacity: { duration: 0.3 },
        }}
      />

      {/* Inner content */}
      <div
        className={cn(
          "relative z-10 rounded-full bg-black px-6 py-2 text-sm font-medium text-white",
          className
        )}
      >
        {children}
      </div>
    </Component>
  );
}
