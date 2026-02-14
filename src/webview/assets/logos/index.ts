// Coding agent logos — Vite resolves these as asset URLs
import claudeCode from "./claude-code.svg";
import kiloCode from "./kilo-code.svg";
import gemini from "./gemini.svg";
import codex from "./codex.svg";
import cursor from "./cursor.svg";

export const AGENT_LOGOS: Record<string, string> = {
  "claude-code": claudeCode,
  "kilo-code": kiloCode,
  "gemini-cli": gemini,
  "codex-cli": codex,
  cursor: cursor,
};
