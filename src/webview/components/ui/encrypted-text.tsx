"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface EncryptedTextProps {
  text: string;
  interval?: number;
  className?: string;
  animateOn?: "view" | "hover" | "mount";
  characterSet?: string;
}

const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

function getRandomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)];
}

export function EncryptedText({
  text,
  interval = 50,
  className,
  animateOn = "mount",
  characterSet = DEFAULT_CHARS,
}: EncryptedTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const iterationRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    iterationRef.current = 0;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setDisplayText((prev) => {
        const revealed = Math.floor(iterationRef.current);
        const result = text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < revealed) return text[index];
            return getRandomChar(characterSet);
          })
          .join("");

        return result;
      });

      iterationRef.current += 1;

      if (iterationRef.current > text.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayText(text);
        setIsAnimating(false);
      }
    }, interval);
  }, [text, interval, characterSet, isAnimating]);

  useEffect(() => {
    if (animateOn === "mount") {
      startAnimation();
    } else {
      setDisplayText(text);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animateOn]);

  const handleMouseEnter = useCallback(() => {
    if (animateOn === "hover") {
      startAnimation();
    }
  }, [animateOn, startAnimation]);

  return (
    <span
      className={cn("inline-block font-mono", className)}
      onMouseEnter={handleMouseEnter}
      aria-label={text}
    >
      {displayText || text}
    </span>
  );
}
