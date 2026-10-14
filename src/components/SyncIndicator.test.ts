import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listen,
}));

import SyncIndicator from "./SyncIndicator";
import { resetPlatformCapabilitiesCache } from "@/utils/platformCapabilities";

function setUserAgent(userAgent: string, platform: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

const MACOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Stik/0.8.2";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Stik/0.8.2";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render() {
  if (!container) throw new Error("no container");
  await act(async () => {
    root = createRoot(container!);
    root.render(React.createElement(SyncIndicator, { enabled: true }));
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  resetPlatformCapabilitiesCache();
  tauriMocks.invoke.mockReset();
  tauriMocks.listen.mockClear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = "";
  resetPlatformCapabilitiesCache();
});

describe("SyncIndicator platform gating", () => {
  it("renders the iCloud indicator on macOS", async () => {
    setUserAgent(MACOS_UA, "MacIntel");
    tauriMocks.invoke.mockResolvedValue({
      os: "macos",
      icloud: true,
      ai_assistant: true,
      apple_notes: true,
      note_lock: true,
    });

    await render();

    expect(container?.querySelector("svg")).not.toBeNull();
    const channels = tauriMocks.listen.mock.calls.map((c) => c[0]);
    expect(channels).toContain("icloud-files-changed");
  });

  it("hides the iCloud indicator on Windows", async () => {
    setUserAgent(WINDOWS_UA, "Win32");
    tauriMocks.invoke.mockResolvedValue({
      os: "windows",
      icloud: false,
      ai_assistant: false,
      apple_notes: false,
      note_lock: false,
    });

    await render();

    expect(container?.innerHTML).toBe("");
    const channels = tauriMocks.listen.mock.calls.map((c) => c[0]);
    expect(channels).not.toContain("icloud-files-changed");
  });
});
