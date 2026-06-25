import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { codeBlockLanguage } from "./cm-code-languages";
import { blockWidgetPlugin } from "./cm-block-widgets";
import { hideMarkersPlugin } from "./cm-hide-markers";

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
        hideMarkersPlugin,
        blockWidgetPlugin,
      ],
    }),
  });
  return view;
}

describe("code block controls widget", () => {
  it("renders language and copy controls for fenced code blocks", () => {
    const editor = createView("```typescript\nconst x = 1;\n```");

    const header = editor.dom.querySelector(".cm-codeblock-header");
    const language = editor.dom.querySelector<HTMLSelectElement>(
      ".cm-codeblock-language",
    );
    const copy = editor.dom.querySelector<HTMLButtonElement>(
      ".cm-codeblock-copy",
    );

    expect(header).not.toBeNull();
    expect(language?.value).toBe("typescript");
    expect(copy?.textContent).toBe("Copy");
  });

  it("updates the opening fence when the selected language changes", () => {
    const editor = createView("```typescript\nconst x = 1;\n```");
    const language = editor.dom.querySelector<HTMLSelectElement>(
      ".cm-codeblock-language",
    );
    expect(language).not.toBeNull();

    language!.value = "python";
    language!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(editor.state.doc.toString()).toBe("```python\nconst x = 1;\n```");
  });

  it("keeps custom existing languages visible in the selector", () => {
    const editor = createView("```mermaid\ngraph TD\n```");
    const language = editor.dom.querySelector<HTMLSelectElement>(
      ".cm-codeblock-language",
    );

    expect(language?.value).toBe("mermaid");
  });

  it("copies only the code block content", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const editor = createView("```typescript\nconst x = 1;\n```");
    const copy = editor.dom.querySelector<HTMLButtonElement>(
      ".cm-codeblock-copy",
    );
    expect(copy).not.toBeNull();

    copy!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("const x = 1;");
    });
  });
});
