import { describe, expect, it } from "vitest";
import {
  buildCodeFenceOpening,
  extractCodeBlockContent,
  getCodeFenceLanguage,
  normalizeCodeBlockLanguage,
} from "./cm-code-block";

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
});
