"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface BackgroundGradientProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}

export function BackgroundGradient({
  children,
  className,
  containerClassName,
  animate = true,
}: BackgroundGradientProps) {
  const gradientVariants = {
    initial: {
      backgroundPosition: "0% 50%",
    },
    animate: {
      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
    },
  };

  return (
    <div className={cn("relative p-[1px] group", containerClassName)}>
      {/* Animated gradient background */}
      <motion.div
        variants={animate ? gradientVariants : undefined}
        initial="initial"
        animate={animate ? "animate" : "initial"}
        transition={
          animate
            ? {
                duration: 5,
                repeat: Infinity,
                repeatType: "loop",
              }
            : undefined
        }
        className={cn(
          "absolute inset-0 rounded-xl opacity-60 blur-xl transition-opacity duration-500 group-hover:opacity-100",
          "will-change-[background-position]"
        )}
        style={{
          background:
            "linear-gradient(-45deg, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #3b82f6)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* Border gradient */}
      <motion.div
        variants={animate ? gradientVariants : undefined}
        initial="initial"
        animate={animate ? "animate" : "initial"}
        transition={
          animate
            ? {
                duration: 5,
                repeat: Infinity,
                repeatType: "loop",
              }
            : undefined
        }
        className="absolute inset-0 rounded-xl will-change-[background-position]"
        style={{
          background:
            "linear-gradient(-45deg, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #3b82f6)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* Inner content */}
      <div
        className={cn(
          "relative z-10 rounded-xl bg-neutral-950",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
