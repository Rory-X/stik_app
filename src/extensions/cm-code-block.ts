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
