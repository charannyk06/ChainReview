"use client";

import { useEffect, useMemo } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

export interface TextGenerateEffectProps {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}

export function TextGenerateEffect({
  words,
  className,
  filter = true,
  duration = 0.5,
}: TextGenerateEffectProps) {
  const [scope, animate] = useAnimate();

  const wordArray = useMemo(() => words.split(" "), [words]);

  useEffect(() => {
    if (!scope.current) return;

    animate(
      "span.word",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration,
        delay: stagger(0.08),
      }
    );
  }, [scope, animate, filter, duration, words]);

  return (
    <div className={cn("font-normal", className)} ref={scope}>
      <div className="leading-snug tracking-wide">
        {wordArray.map((word, idx) => (
          <motion.span
            key={`${word}-${idx}`}
            className="word inline-block"
            style={{
              opacity: 0,
              filter: filter ? "blur(10px)" : "none",
            }}
          >
            {word}
            {idx < wordArray.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
