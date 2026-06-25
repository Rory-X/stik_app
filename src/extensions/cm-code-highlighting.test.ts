import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { codeBlockLanguage } from "./cm-code-languages";
import { stikHighlightStyle } from "./cm-theme";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = "";
});

function createView(doc: string) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ base: markdownLanguage, codeLanguages: codeBlockLanguage }),
        stikHighlightStyle,
      ],
    }),
  });
  return view;
}

describe("code block syntax highlighting", () => {
  it("styles programming-language tokens inside fenced code blocks", () => {
    const editor = createView(
      "```typescript\nconst answer = 42;\nconsole.log(\"hi\");\n```",
    );

    const highlighted = Array.from(
      editor.dom.querySelectorAll<HTMLElement>(".cm-line span[class]"),
    );
    const classesByText = new Map(
      highlighted.map((node) => [node.textContent, node.className]),
    );

    expect(classesByText.has("const")).toBe(true);
    expect(classesByText.has("42")).toBe(true);
    expect(classesByText.has("\"hi\"")).toBe(true);
    expect(
      new Set([
        classesByText.get("const"),
        classesByText.get("42"),
        classesByText.get("\"hi\""),
      ]).size,
    ).toBe(3);
  });

  it("matches common aliases to different language parsers", () => {
    const aliases = ["ts", "py", "rs", "bash", "yml"];

    expect(aliases.map((alias) => codeBlockLanguage(alias)?.name)).toEqual([
      "typescript",
      "python",
      "rust",
      "shell",
      "yaml",
    ]);
  });
});
