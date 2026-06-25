import type { Language, LanguageDescription } from "@codemirror/language";
import { StreamLanguage } from "@codemirror/language";
import { cppLanguage } from "@codemirror/lang-cpp";
import { cssLanguage } from "@codemirror/lang-css";
import { goLanguage } from "@codemirror/lang-go";
import { htmlLanguage } from "@codemirror/lang-html";
import { javaLanguage } from "@codemirror/lang-java";
import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage,
} from "@codemirror/lang-javascript";
import { jsonLanguage } from "@codemirror/lang-json";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { pythonLanguage } from "@codemirror/lang-python";
import { rustLanguage } from "@codemirror/lang-rust";
import { StandardSQL } from "@codemirror/lang-sql";
import { yamlLanguage } from "@codemirror/lang-yaml";
import { c, csharp, kotlin } from "@codemirror/legacy-modes/mode/clike";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";

const cLanguage = StreamLanguage.define(c);
const csharpLanguage = StreamLanguage.define(csharp);
const dockerfileLanguage = StreamLanguage.define(dockerFile);
const kotlinLanguage = StreamLanguage.define(kotlin);
const shellLanguage = StreamLanguage.define(shell);
const swiftLanguage = StreamLanguage.define(swift);
const tomlLanguage = StreamLanguage.define(toml);

const LANGUAGE_BY_NAME: Record<string, Language> = {
  bash: shellLanguage,
  c: cLanguage,
  cpp: cppLanguage,
  "c++": cppLanguage,
  csharp: csharpLanguage,
  "c#": csharpLanguage,
  css: cssLanguage,
  docker: dockerfileLanguage,
  dockerfile: dockerfileLanguage,
  go: goLanguage,
  golang: goLanguage,
  html: htmlLanguage,
  java: javaLanguage,
  javascript: javascriptLanguage,
  js: javascriptLanguage,
  json: jsonLanguage,
  jsx: jsxLanguage,
  kotlin: kotlinLanguage,
  kt: kotlinLanguage,
  markdown: markdownLanguage,
  md: markdownLanguage,
  py: pythonLanguage,
  python: pythonLanguage,
  rs: rustLanguage,
  rust: rustLanguage,
  sh: shellLanguage,
  shell: shellLanguage,
  sql: StandardSQL.language,
  swift: swiftLanguage,
  toml: tomlLanguage,
  ts: typescriptLanguage,
  tsx: tsxLanguage,
  typescript: typescriptLanguage,
  yaml: yamlLanguage,
  yml: yamlLanguage,
};

export function codeBlockLanguage(
  info: string,
): Language | LanguageDescription | null {
  const name = info.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (!name || name === "plain" || name === "plaintext" || name === "text" || name === "txt") {
    return null;
  }

  return LANGUAGE_BY_NAME[name] ?? null;
}
