import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDownIcon, ChevronRightIcon, BrainIcon } from "lucide-react";

interface ReasoningBlockProps {
  text: string;
  defaultCollapsed?: boolean;
}

export function ReasoningBlock({ text, defaultCollapsed = true }: ReasoningBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hovered, setHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollable = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1);
    }
  }, []);

  useEffect(() => {
    checkScrollable();
  }, [text, collapsed, checkScrollable]);

  return (
    <div style={{ margin: "4px 0" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textAlign: "left",
          userSelect: "none",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 6,
          transition: "background 150ms ease",
          background: hovered ? "var(--cr-bg-hover)" : "transparent",
          border: "none",
        }}
      >
        <BrainIcon style={{ width: 12, height: 12, color: "var(--cr-text-ghost)" }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--cr-text-muted)" }}>Thoughts</span>
        {collapsed ? (
          <ChevronRightIcon style={{ width: 12, height: 12, color: "var(--cr-text-ghost)" }} />
        ) : (
          <ChevronDownIcon style={{ width: 12, height: 12, color: "var(--cr-text-ghost)" }} />
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ position: "relative", marginTop: 2 }}>
              <div
                ref={scrollRef}
                onScroll={checkScrollable}
                style={{
                  paddingLeft: 10,
                  borderLeft: "1px solid var(--cr-border-subtle)",
                  maxHeight: 150,
                  overflowY: "auto",
                  fontSize: 12,
                  color: "var(--cr-text-muted)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                <span style={{ display: "block", paddingBottom: 8 }}>{text}</span>
              </div>
              {canScrollDown && (
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 24,
                  pointerEvents: "none",
                  background: "linear-gradient(to top, var(--cr-bg-primary), transparent)",
                }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
