import { cn } from "@/lib/utils";

interface MarkdownBlockProps {
  text: string;
  className?: string;
}

/**
 * Lightweight markdown renderer supporting bold, code, headers, lists, and code blocks.
 */
export function MarkdownBlock({ text, className }: MarkdownBlockProps) {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={elements.length}
          className="my-1.5 px-3 py-2 rounded-lg bg-[var(--cr-bg-tertiary)] border border-[var(--cr-border-subtle)] text-[11px] font-mono text-[var(--cr-text-secondary)] overflow-x-auto"
        >
          {lang && (
            <span className="text-[9px] text-[var(--cr-text-ghost)] block mb-1 uppercase tracking-wider font-semibold">{lang}</span>
          )}
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={elements.length} className="text-xs font-semibold text-[var(--cr-text-primary)] mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={elements.length} className="text-xs font-bold text-[var(--cr-text-primary)] mt-2 mb-0.5">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <div key={elements.length} className="flex gap-2 ml-2">
          <span className="text-[var(--cr-text-ghost)] text-xs select-none">•</span>
          <span className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
            {renderInline(line.slice(2))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      elements.push(<div key={elements.length} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={elements.length} className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className={cn("space-y-1.5", className)}>{elements}</div>;
}

function renderInline(text: string): (string | JSX.Element)[] {
  const result: (string | JSX.Element)[] = [];
  // Match **bold**, `code`, and [severity] badges
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([A-Z]+)\])/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      result.push(
        <strong key={key++} className="font-semibold text-[var(--cr-text-primary)]">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      result.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-[var(--cr-bg-tertiary)] text-[11px] font-mono text-amber-300/90 border border-[var(--cr-border-subtle)]"
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      // Badge [CRITICAL] etc
      result.push(
        <span
          key={key++}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-secondary)] border border-[var(--cr-border-subtle)]"
        >
          {match[4]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
