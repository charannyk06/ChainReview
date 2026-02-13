import { motion } from "motion/react";

export function TextShimmer() {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      {[80, 60, 40].map((width, i) => (
        <motion.div
          key={i}
          className="h-2.5 rounded-sm"
          style={{
            width: `${width}%`,
            background:
              "linear-gradient(90deg, var(--cr-bg-tertiary) 25%, var(--cr-bg-hover) 50%, var(--cr-bg-tertiary) 75%)",
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "linear",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
