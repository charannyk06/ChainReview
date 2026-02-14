import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import {
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  ShieldCheckIcon,
  NetworkIcon,
  BugIcon,
  UsersIcon,
} from "lucide-react";

// ─── Agent Definitions ───────────────────────────────────────────────────────

export interface AgentMention {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export const AVAILABLE_AGENTS: AgentMention[] = [
  {
    id: "security",
    name: "Security",
    description: "Find vulnerabilities, injection flaws, auth issues",
    icon: <ShieldCheckIcon className="size-3.5" />,
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "Analyze structure, dependencies, boundaries",
    icon: <NetworkIcon className="size-3.5" />,
  },
  {
    id: "bugs",
    name: "Bugs",
    description: "Find logic errors, null handling, race conditions",
    icon: <BugIcon className="size-3.5" />,
  },
  {
    id: "all",
    name: "All",
    description: "Run all agents (Security → Architecture → Bugs)",
    icon: <UsersIcon className="size-3.5" />,
  },
];

// ─── Mention Suggestion Component ────────────────────────────────────────────

interface SuggestionProps {
  items: AgentMention[];
  command: (item: AgentMention) => void;
  selectedIndex: number;
}

function MentionSuggestion({ items, command, selectedIndex }: SuggestionProps) {
  if (items.length === 0) return null;

  return (
    <div className="mention-suggestion-list">
      <div className="text-[10px] font-medium text-[var(--cr-text-muted)] px-2.5 py-1.5 border-b border-[var(--cr-border-subtle)]">
        Agents
      </div>
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => command(item)}
          className={cn(
            "mention-suggestion-item",
            index === selectedIndex && "is-selected"
          )}
        >
          <span className="mention-suggestion-icon">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--cr-text-primary)]">
              @{item.name}
            </div>
            <div className="text-[10px] text-[var(--cr-text-muted)] truncate">
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Suggestion Plugin ───────────────────────────────────────────────────────

interface SuggestionState {
  query: string;
  items: AgentMention[];
  selectedIndex: number;
  clientRect: (() => DOMRect | null) | null;
  command: (item: AgentMention) => void;
}

function createSuggestionPlugin(
  setSuggestionState: React.Dispatch<React.SetStateAction<SuggestionState | null>>
) {
  return {
    items: ({ query }: { query: string }): AgentMention[] => {
      return AVAILABLE_AGENTS.filter((agent) =>
        agent.name.toLowerCase().startsWith(query.toLowerCase())
      );
    },

    render: () => {
      let selectedIndex = 0;

      return {
        onStart: (props: any) => {
          selectedIndex = 0;
          setSuggestionState({
            query: props.query,
            items: props.items,
            selectedIndex,
            clientRect: props.clientRect,
            command: props.command,
          });
        },

        onUpdate: (props: any) => {
          const items: AgentMention[] = props.items ?? [];
          selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
          setSuggestionState({
            query: props.query,
            items,
            selectedIndex,
            clientRect: props.clientRect,
            command: props.command,
          });
        },

        onKeyDown: (props: any) => {
          const items: AgentMention[] = props.items ?? [];

          if (props.event.key === "ArrowUp") {
            selectedIndex =
              selectedIndex <= 0
                ? Math.max(items.length - 1, 0)
                : selectedIndex - 1;
            setSuggestionState((prev) =>
              prev ? { ...prev, selectedIndex } : null
            );
            return true;
          }

          if (props.event.key === "ArrowDown") {
            selectedIndex =
              items.length === 0
                ? 0
                : selectedIndex >= items.length - 1
                ? 0
                : selectedIndex + 1;
            setSuggestionState((prev) =>
              prev ? { ...prev, selectedIndex } : null
            );
            return true;
          }

          if (props.event.key === "Enter") {
            if (items[selectedIndex]) {
              props.command(items[selectedIndex]);
            }
            return true;
          }

          if (props.event.key === "Escape") {
            setSuggestionState(null);
            return true;
          }

          return false;
        },

        onExit: () => {
          setSuggestionState(null);
        },
      };
    },
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface MentionInputHandle {
  focus: () => void;
  clear: () => void;
  getText: () => string;
  getMentions: () => string[];
}

interface MentionInputProps {
  placeholder?: string;
  disabled?: boolean;
  onSubmit?: (text: string, mentions: string[]) => void;
  onChange?: (text: string, mentions: string[]) => void;
  className?: string;
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  ({ placeholder, disabled, onSubmit, onChange, className }, ref) => {
    const [suggestionState, setSuggestionState] =
      useState<SuggestionState | null>(null);

    const suggestionPlugin = useMemo(
      () => createSuggestionPlugin(setSuggestionState),
      []
    );

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: placeholder || "Type @ to mention an agent...",
          emptyNodeClass: "is-empty",
        }),
        Mention.configure({
          HTMLAttributes: {
            class: "mention-tag",
          },
          suggestion: suggestionPlugin,
          renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        }),
      ],
      editable: !disabled,
      editorProps: {
        attributes: {
          class: "mention-editor-content",
        },
        handleKeyDown: (view, event) => {
          if (event.key === "Enter" && !event.shiftKey && !suggestionState) {
            event.preventDefault();
            const text = getText();
            const mentions = getMentions();
            if (text.trim() && onSubmit) {
              onSubmit(text, mentions);
              editor?.commands.clearContent();
            }
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        const mentions = getMentionsFromEditor(editor);
        onChange?.(text, mentions);
      },
    });

    const getText = useCallback((): string => {
      if (!editor) return "";
      return editor.getText();
    }, [editor]);

    const getMentions = useCallback((): string[] => {
      if (!editor) return [];
      return getMentionsFromEditor(editor);
    }, [editor]);

    const getMentionsFromEditor = (ed: Editor): string[] => {
      const mentions: string[] = [];
      ed.state.doc.descendants((node) => {
        if (node.type.name === "mention") {
          mentions.push(node.attrs.id);
        }
      });
      return mentions;
    };

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(),
      getText,
      getMentions,
    }));

    useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled);
      }
    }, [disabled, editor]);

    // Render suggestion popup
    const suggestionPortal = useMemo(() => {
      if (!suggestionState || suggestionState.items.length === 0) return null;

      const rect = suggestionState.clientRect?.();
      if (!rect) return null;

      const style: React.CSSProperties = {
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        zIndex: 9999,
      };

      return createPortal(
        <div style={style}>
          <MentionSuggestion
            items={suggestionState.items}
            selectedIndex={suggestionState.selectedIndex}
            command={(item) => {
              suggestionState.command(item);
              setSuggestionState(null);
            }}
          />
        </div>,
        document.body
      );
    }, [suggestionState]);

    return (
      <>
        <div className={cn("mention-input-wrapper", className)}>
          <EditorContent editor={editor} />
        </div>
        {suggestionPortal}
      </>
    );
  }
);

MentionInput.displayName = "MentionInput";
