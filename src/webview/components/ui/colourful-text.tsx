"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ColourfulTextProps {
  text: string;
  className?: string;
}

const RAINBOW_COLORS = [
  "#ff0000",
  "#ff4500",
  "#ff8c00",
  "#ffd700",
  "#adff2f",
  "#00ff00",
  "#00ced1",
  "#1e90ff",
  "#6a5acd",
  "#9400d3",
  "#ff1493",
  "#ff69b4",
];

function getColorForIndex(index: number, offset: number): string {
  return RAINBOW_COLORS[(index + offset) % RAINBOW_COLORS.length];
}

export function ColourfulText({ text, className }: ColourfulTextProps) {
  const [colorOffset, setColorOffset] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const characters = useMemo(() => text.split(""), [text]);

  const handleHoverStart = useCallback(() => {
    setIsHovered(true);
    setColorOffset((prev) => prev + 3);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <motion.span
      className={cn("inline-flex cursor-default", className)}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
    >
      {characters.map((char, index) => (
        <motion.span
          key={`${index}-${char}`}
          className="inline-block whitespace-pre"
          animate={{
            color: isHovered
              ? getColorForIndex(index, colorOffset)
              : "currentColor",
            scale: isHovered ? [1, 1.15, 1] : 1,
          }}
          transition={{
            color: {
              duration: 0.3,
              delay: index * 0.02,
            },
            scale: {
              duration: 0.3,
              delay: index * 0.02,
            },
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}
