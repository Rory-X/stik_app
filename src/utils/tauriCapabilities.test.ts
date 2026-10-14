import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TauriCapability {
  windows?: string[];
  permissions?: Array<string | { identifier?: string }>;
}

function readDefaultCapability(): TauriCapability {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "src-tauri/capabilities/default.json"),
      "utf8",
    ),
  ) as TauriCapability;
}

describe("Tauri default capability", () => {
  it("allows recovered session draft windows to use native dragging", () => {
    const capability = readDefaultCapability();

    expect(capability.windows).toContain("draft-*");
    expect(capability.permissions).toContain("core:window:allow-start-dragging");
  });
});
