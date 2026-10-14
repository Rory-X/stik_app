import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve("tailwindcss/package.json"));
const micromatchRequire = createRequire(tailwindRequire.resolve("micromatch"));
const paths = new Set([require.resolve("braces"), micromatchRequire.resolve("braces")]);

for (const path of paths) {
  const braces = require(path);
  const rejectDepth = (error) =>
    error instanceof SyntaxError &&
    error.message === "Brace pattern nesting exceeds maximum depth (128)";

  // Fail quickly on an unpatched install before exercising the stack-overflow
  // payload. Include parentheses: limiting only brace depth leaves a bypass.
  for (const [open, close] of [["{", "}"], ["(", ")"], ["{(", ")}"]]) {
    assert.throws(() => braces.parse(open.repeat(129) + "x" + close.repeat(129)), rejectDepth);
    const payload = open.repeat(2000) + "x" + close.repeat(2000);
    for (const operation of ["parse", "compile", "expand", "stringify"]) {
      assert.throws(() => braces[operation](payload), rejectDepth, `${path}: ${operation}`);
      assert.throws(() => braces[operation](open.repeat(129) + "x"), rejectDepth);
    }
  }

  const boundary = "{".repeat(128) + "x" + "}".repeat(128);
  for (const operation of ["parse", "compile", "expand", "stringify"]) {
    assert.doesNotThrow(() => braces[operation](boundary));
  }
  assert.equal(braces.stringify(boundary), boundary);
  assert.deepEqual(braces.expand("src/{a,b}.{ts,tsx}"), [
    "src/a.ts", "src/a.tsx", "src/b.ts", "src/b.tsx",
  ]);
  assert.equal(braces.compile("src/{a,b}.{ts,tsx}"), "src/(a|b).(ts|tsx)");
  const escaped = "\\{".repeat(129) + "x";
  assert.equal(braces.stringify(escaped), "{".repeat(129) + "x");
}

console.log("Dependency patch verified: braces nesting is bounded on build dependency paths.");
