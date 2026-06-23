import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TauriConfig {
  app?: {
    security?: {
      csp?: string;
    };
  };
}

function readTauriConfig(): TauriConfig {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
  ) as TauriConfig;
}

function cspSourcesFor(csp: string, directive: string): string[] {
  const section = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directive} `));
  return section ? section.split(/\s+/).slice(1) : [];
}

describe("Tauri asset CSP", () => {
  it("allows release builds to load Tauri asset protocol images", () => {
    const csp = readTauriConfig().app?.security?.csp ?? "";

    expect(cspSourcesFor(csp, "img-src")).toContain("asset:");
  });
});
