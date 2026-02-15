interface MarkdownBlockProps {
  text: string;
  className?: string;
}

/**
 * Lightweight markdown renderer supporting bold, code, headers, lists, and code blocks.
 */
export function MarkdownBlock({ text }: MarkdownBlockProps) {
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
          style={{
            margin: "10px 0",
            padding: "12px 16px",
            borderRadius: 12,
            background: "var(--cr-bg-tertiary)",
            border: "1px solid var(--cr-border-subtle)",
            fontSize: 11.5,
            fontFamily: "var(--cr-font-mono)",
            color: "var(--cr-text-secondary)",
            overflowX: "auto",
            lineHeight: 1.6,
          }}
        >
          {lang && (
            <span style={{
              fontSize: 9,
              color: "var(--cr-text-ghost)",
              display: "block",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}>{lang}</span>
          )}
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={elements.length} style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--cr-text-primary)",
          marginTop: 16,
          marginBottom: 4,
        }}>
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={elements.length} style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--cr-text-primary)",
          marginTop: 16,
          marginBottom: 4,
        }}>
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <div key={elements.length} style={{
          display: "flex",
          gap: 10,
          marginLeft: 4,
          padding: "2px 0",
        }}>
          <span style={{
            color: "var(--cr-text-ghost)",
            fontSize: 13,
            userSelect: "none",
            lineHeight: 1.65,
          }}>&#8226;</span>
          <span style={{
            fontSize: 13,
            color: "var(--cr-text-secondary)",
            lineHeight: 1.65,
          }}>
            {renderInline(line.slice(2))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Empty lines — paragraph break
    if (line.trim() === "") {
      elements.push(<div key={elements.length} style={{ height: 12 }} />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={elements.length} style={{
        fontSize: 13,
        color: "var(--cr-text-secondary)",
        lineHeight: 1.7,
        margin: 0,
      }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{elements}</div>;
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
        <strong key={key++} style={{ fontWeight: 600, color: "var(--cr-text-primary)" }}>
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      result.push(
        <code
          key={key++}
          style={{
            padding: "2px 6px",
            borderRadius: 6,
            background: "var(--cr-bg-tertiary)",
            fontSize: 12,
            fontFamily: "var(--cr-font-mono)",
            color: "rgba(252,211,77,0.90)",
            border: "1px solid var(--cr-border-subtle)",
          }}
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      // Badge [CRITICAL] etc
      result.push(
        <span
          key={key++}
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 9999,
            background: "var(--cr-bg-tertiary)",
            color: "var(--cr-text-secondary)",
            border: "1px solid var(--cr-border-subtle)",
          }}
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
