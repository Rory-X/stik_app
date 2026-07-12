import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { codeBlockLanguage } from "./cm-code-languages";
import {
  buildCodeFenceOpening,
  buildCodeBlockPasteSpec,
  extractCodeBlockContent,
  getCodeFenceLanguage,
  normalizeCodeBlockLanguage,
} from "./cm-code-block";

function createCodeBlockState(doc: string, cursor: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage, codeLanguages: codeBlockLanguage }),
    ],
  });
}

describe("code block helpers", () => {
  it("normalizes missing languages to plaintext", () => {
    expect(normalizeCodeBlockLanguage("")).toBe("plaintext");
    expect(normalizeCodeBlockLanguage(null)).toBe("plaintext");
    expect(normalizeCodeBlockLanguage(" tsx ")).toBe("tsx");
  });

  it("reads the language from a fenced code opening line", () => {
    expect(getCodeFenceLanguage("```typescript")).toBe("typescript");
    expect(getCodeFenceLanguage("```")).toBe("plaintext");
    expect(getCodeFenceLanguage("~~~python")).toBe("python");
  });

  it("rebuilds the opening fence while preserving delimiter style", () => {
    expect(buildCodeFenceOpening("```typescript", "python")).toBe("```python");
    expect(buildCodeFenceOpening("~~~", "rust")).toBe("~~~rust");
    expect(buildCodeFenceOpening("```tsx", "plaintext")).toBe("```plaintext");
  });

  it("extracts code content without fences or language", () => {
    expect(extractCodeBlockContent("```ts\nconst x = 1;\n```")).toBe(
      "const x = 1;",
    );
    expect(extractCodeBlockContent("```python\nprint('hi')\n```")).toBe(
      "print('hi')",
    );
    expect(extractCodeBlockContent("```rust\nlet x = 1;")).toBe("let x = 1;");
  });

  it("keeps pasted markdown fences as literal code block content", () => {
    const initialDoc = "```plaintext\n\n```";
    const pastedMarkdown = "```markdown\n**bold**\n```";
    const cursor = "```plaintext\n".length;
    const state = createCodeBlockState(initialDoc, cursor);

    const pasteSpec = buildCodeBlockPasteSpec(state, pastedMarkdown);
    expect(pasteSpec).not.toBeNull();
    const afterPaste = state.update(pasteSpec!).state;
    expect(afterPaste.doc.toString()).toBe(
      "````plaintext\n```markdown\n**bold**\n```\n````",
    );
    const cursorNode = syntaxTree(afterPaste).cursor();
    let fencedCodeBlocks = 0;
    do {
      if (cursorNode.name === "FencedCode") fencedCodeBlocks += 1;
    } while (cursorNode.next());

    expect(fencedCodeBlocks).toBe(1);
  });

  it("pastes ordinary markdown syntax without changing the fence", () => {
    const initialDoc = "```plaintext\n\n```";
    const cursor = "```plaintext\n".length;
    const state = createCodeBlockState(initialDoc, cursor);

    const pasteSpec = buildCodeBlockPasteSpec(state, "# heading\n**bold**");
    expect(pasteSpec).not.toBeNull();
    expect(state.update(pasteSpec!).state.doc.toString()).toBe(
      "```plaintext\n# heading\n**bold**\n```",
    );
  });

  it("lengthens tilde fences when pasted content contains tildes", () => {
    const initialDoc = "~~~plaintext\n\n~~~";
    const cursor = "~~~plaintext\n".length;
    const state = createCodeBlockState(initialDoc, cursor);

    const pasteSpec = buildCodeBlockPasteSpec(state, "~~~markdown\ntext\n~~~");
    expect(pasteSpec).not.toBeNull();
    expect(state.update(pasteSpec!).state.doc.toString()).toBe(
      "~~~~plaintext\n~~~markdown\ntext\n~~~\n~~~~",
    );
  });

  it("protects an unclosed code block when pasting at document end", () => {
    const initialDoc = "```plaintext\nexisting code";
    const cursor = initialDoc.length;
    const state = createCodeBlockState(initialDoc, cursor);

    const pasteSpec = buildCodeBlockPasteSpec(
      state,
      "\n```markdown\n**bold**\n```",
    );

    expect(pasteSpec).not.toBeNull();
    expect(state.update(pasteSpec!).state.doc.toString()).toBe(
      "````plaintext\nexisting code\n```markdown\n**bold**\n```",
    );
  });

  it("does not intercept paste outside a fenced code block", () => {
    const state = EditorState.create({
      doc: "plain text",
      selection: { anchor: 5 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(buildCodeBlockPasteSpec(state, "**bold**")).toBeNull();
  });
});
