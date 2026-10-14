import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformCapabilities } from "@/types";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

import {
  guessPlatformCapabilities,
  loadPlatformCapabilities,
  resetPlatformCapabilitiesCache,
} from "./platformCapabilities";

const MACOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Stik/0.8.2";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Stik/0.8.2";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Stik/0.8.2";

const ALL_CAPABILITY_KEYS = [
  "clip_capture",
  "ai_assistant",
  "icloud",
  "apple_notes",
  "note_lock",
  "image_copy",
  "dictation",
  "semantic_search",
  "hide_dock_icon",
] as const;

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

function capabilitiesFromBackend(
  overrides: Partial<PlatformCapabilities> = {},
): PlatformCapabilities {
  return {
    os: "macos",
    clip_capture: true,
    ai_assistant: true,
    icloud: true,
    apple_notes: true,
    note_lock: true,
    image_copy: true,
    dictation: true,
    semantic_search: true,
    hide_dock_icon: true,
    ...overrides,
  };
}

beforeEach(() => {
  tauriMocks.invoke.mockReset();
  resetPlatformCapabilitiesCache();
  setUserAgent(MACOS_UA, "MacIntel");
});

afterEach(() => {
  resetPlatformCapabilitiesCache();
  vi.restoreAllMocks();
});

describe("guessPlatformCapabilities", () => {
  it("reports macOS with every capability enabled", () => {
    setUserAgent(MACOS_UA, "MacIntel");

    const capabilities = guessPlatformCapabilities();

    expect(capabilities.os).toBe("macos");
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(capabilities[key]).toBe(true);
    }
  });

  it("reports Windows with every capability disabled", () => {
    setUserAgent(WINDOWS_UA, "Win32");

    const capabilities = guessPlatformCapabilities();

    expect(capabilities.os).toBe("windows");
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(capabilities[key]).toBe(false);
    }
  });

  it("reports Linux with every capability disabled", () => {
    setUserAgent(LINUX_UA, "Linux x86_64");

    const capabilities = guessPlatformCapabilities();

    expect(capabilities.os).toBe("linux");
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(capabilities[key]).toBe(false);
    }
  });
});

describe("loadPlatformCapabilities", () => {
  it("returns the backend capabilities when the command succeeds", async () => {
    setUserAgent(WINDOWS_UA, "Win32");
    const backend = capabilitiesFromBackend({
      os: "windows",
      clip_capture: false,
      ai_assistant: false,
      icloud: false,
      apple_notes: false,
      note_lock: false,
    });
    tauriMocks.invoke.mockResolvedValue(backend);

    await expect(loadPlatformCapabilities()).resolves.toEqual(backend);
    expect(tauriMocks.invoke).toHaveBeenCalledWith("get_platform_capabilities");
  });

  it("falls back to the user-agent guess when the command fails", async () => {
    setUserAgent(WINDOWS_UA, "Win32");
    tauriMocks.invoke.mockRejectedValue(new Error("command not found"));

    const capabilities = await loadPlatformCapabilities();

    expect(capabilities).toEqual(guessPlatformCapabilities());
    expect(capabilities.os).toBe("windows");
    expect(capabilities.ai_assistant).toBe(false);
  });

  it("invokes the command only once across calls", async () => {
    const backend = capabilitiesFromBackend();
    tauriMocks.invoke.mockResolvedValue(backend);

    const [first, second, third] = await Promise.all([
      loadPlatformCapabilities(),
      loadPlatformCapabilities(),
      loadPlatformCapabilities(),
    ]);
    await loadPlatformCapabilities();

    expect(tauriMocks.invoke).toHaveBeenCalledTimes(1);
    expect(first).toEqual(backend);
    expect(second).toEqual(backend);
    expect(third).toEqual(backend);
  });

  it("caches the fallback result instead of retrying", async () => {
    tauriMocks.invoke.mockRejectedValue(new Error("boom"));

    await loadPlatformCapabilities();
    await loadPlatformCapabilities();

    expect(tauriMocks.invoke).toHaveBeenCalledTimes(1);
  });
});
