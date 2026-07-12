import { syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Transaction,
  type ChangeSpec,
  type TransactionSpec,
} from "@codemirror/state";

export interface CodeBlockLanguageOption {
  value: string;
  label: string;
}

export const CODE_BLOCK_LANGUAGE_OPTIONS: CodeBlockLanguageOption[] = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "bash", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "sql", label: "SQL" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
  { value: "dockerfile", label: "Dockerfile" },
];

const FENCE_OPENING_RE = /^(`{3,}|~{3,})([^\n`]*)$/;
const FENCED_BLOCK_RE = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1$/;
const INDENTED_FENCE_OPENING_RE = /^(\s{0,3})(`{3,}|~{3,})/;

export function normalizeCodeBlockLanguage(
  language: string | null | undefined,
): string {
  return language?.trim() || "plaintext";
}

export function getCodeFenceLanguage(openingLine: string): string {
  const match = openingLine.match(FENCE_OPENING_RE);
  return normalizeCodeBlockLanguage(match?.[2]);
}

export function buildCodeFenceOpening(
  openingLine: string,
  language: string,
): string {
  const match = openingLine.match(FENCE_OPENING_RE);
  const delimiter = match?.[1] ?? "```";
  return `${delimiter}${normalizeCodeBlockLanguage(language)}`;
}

export function extractCodeBlockContent(source: string): string {
  const match = source.match(FENCED_BLOCK_RE);
  if (match) return match[2];

  const lines = source.split("\n");
  if (lines.length > 1 && FENCE_OPENING_RE.test(lines[0])) {
    return lines.slice(1).join("\n");
  }

  return source;
}

function longestRun(text: string, character: string): number {
  let longest = 0;
  let current = 0;

  for (const value of text) {
    if (value === character) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

/**
 * If the pasted text contains a matching fence, the containing fence is lengthened
 * so Markdown continues to treat every pasted character as code content.
 */
export function buildCodeBlockPasteSpec(
  state: EditorState,
  text: string,
): TransactionSpec | null {
  const { from, to } = state.selection.main;
  let node = syntaxTree(state).resolveInner(from, -1);

  while (node.name !== "FencedCode" && node.parent) {
    node = node.parent;
  }
  if (node.name !== "FencedCode" || to > node.to) return null;

  const openingLine = state.doc.lineAt(node.from);
  const openingMatch = openingLine.text.match(INDENTED_FENCE_OPENING_RE);
  if (!openingMatch) return null;

  const contentFrom = openingLine.to < state.doc.length
    ? openingLine.to + 1
    : openingLine.to;
  if (from < contentFrom) return null;

  const openingDelimiter = openingMatch[2];
  const fenceCharacter = openingDelimiter[0];
  const lastBlockPosition = Math.max(node.from, node.to - 1);
  const possibleClosingLine = state.doc.lineAt(lastBlockPosition);
  const closingMatch = possibleClosingLine.text.match(
    new RegExp(`^(\\s{0,3})(${fenceCharacter}{${openingDelimiter.length},})[ \\t]*$`),
  );
  const hasClosingFence = Boolean(
    closingMatch && possibleClosingLine.number !== openingLine.number,
  );
  const contentTo = hasClosingFence ? possibleClosingLine.from : node.to;
  if (to > contentTo) return null;

  const pastedFenceLength = longestRun(text, fenceCharacter);
  const nextFenceLength = pastedFenceLength >= openingDelimiter.length
    ? pastedFenceLength + 1
    : openingDelimiter.length;
  const openingDelta = nextFenceLength - openingDelimiter.length;
  const changes: ChangeSpec[] = [];

  if (openingDelta > 0) {
    const openingFrom = openingLine.from + openingMatch[1].length;
    changes.push({
      from: openingFrom,
      to: openingFrom + openingDelimiter.length,
      insert: fenceCharacter.repeat(nextFenceLength),
    });
  }

  changes.push({ from, to, insert: text });

  if (openingDelta > 0 && hasClosingFence && closingMatch) {
    const closingDelimiter = closingMatch[2];
    const closingLength = Math.max(nextFenceLength, closingDelimiter.length);
    const closingFrom = possibleClosingLine.from + closingMatch[1].length;
    changes.push({
      from: closingFrom,
      to: closingFrom + closingDelimiter.length,
      insert: fenceCharacter.repeat(closingLength),
    });
  }

  return {
    changes,
    selection: { anchor: from + openingDelta + text.length },
    annotations: Transaction.userEvent.of("input.paste"),
    scrollIntoView: true,
  };
}
