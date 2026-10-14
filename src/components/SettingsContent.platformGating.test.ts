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

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import SettingsContent from "./SettingsContent";
import type { SettingsTab } from "./SettingsContent";
import { resetPlatformCapabilitiesCache } from "@/utils/platformCapabilities";

const MACOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Stik/0.8.2";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Stik/0.8.2";

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

const settings = {
  shortcut_mappings: [],
  default_folder: "Inbox",
  locale: "en",
  has_completed_onboarding: true,
  git_sharing: {
    enabled: false,
    shared_folder: "Inbox",
    remote_url: "",
    branch: "main",
    repository_layout: "folder_root",
    sync_interval_seconds: 60,
  },
  ai_features_enabled: true,
  vim_mode_enabled: false,
  theme_mode: "light",
  notes_directory: "",
  hide_dock_icon: false,
  folder_colors: {},
  system_shortcuts: {},
  analytics_enabled: false,
  analytics_notice_dismissed: true,
  font_size: 14,
  custom_templates: [],
  sidebar_position: "left",
  auto_update_enabled: true,
  text_direction: "auto",
  hide_tray_icon: false,
  capture_window_size: null,
  active_theme: "",
  custom_themes: [],
  icloud: { enabled: false, migrated: false },
  note_lock: { enabled: false, timeout_minutes: 15, lock_on_sleep: true },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(tab: SettingsTab) {
  if (!container) throw new Error("no container");
  await act(async () => {
    root = createRoot(container!);
    root.render(
      React.createElement(SettingsContent, {
        activeTab: tab,
        settings: settings as never,
        folders: ["Inbox"],
        onSettingsChange: vi.fn(),
        resolvedNotesDir: "/tmp/Stik",
        captureStreakLabel: "",
        captureStreakDays: null,
        isRefreshingStreak: false,
        onRefreshCaptureStreak: vi.fn(async () => {}),
        onThisDayMessage: "",
        onThisDayPreview: null,
        onThisDayDate: null,
        onThisDayFolder: null,
        isCheckingOnThisDay: false,
        onCheckOnThisDay: vi.fn(async () => {}),
        gitSyncStatus: null,
        isPreparingGitRepo: false,
        isSyncingGitNow: false,
        isOpeningGitRemote: false,
        onPrepareGitRepository: vi.fn(async () => {}),
        onSyncGitNow: vi.fn(async () => {}),
        onOpenGitRemote: vi.fn(async () => {}),
      } as never),
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let backendCapabilities: Record<string, unknown> = {};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  resetPlatformCapabilitiesCache();
  backendCapabilities = {};
  tauriMocks.invoke.mockReset();
  tauriMocks.invoke.mockImplementation((command: string) => {
    if (command === "get_platform_capabilities")
      return Promise.resolve(backendCapabilities);
    if (command === "get_analytics_device_id") return Promise.resolve("dev-1");
    if (command === "auth_available") return Promise.resolve(false);
    return Promise.resolve(null);
  });
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

describe("SettingsContent platform gating", () => {
  it("shows clip_capture and note locking on macOS", async () => {
    setUserAgent(MACOS_UA, "MacIntel");
    backendCapabilities = {
      os: "macos",
      icloud: true,
      ai_assistant: true,
      clip_capture: true,
      note_lock: true,
    };

    await render("shortcuts");
    expect(container?.textContent).toContain("Capture clipboard");

    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    await render("privacy");
    expect(container?.textContent).toContain("Note Locking");
  });

  it("hides clip_capture, iCloud and note locking on Windows", async () => {
    setUserAgent(WINDOWS_UA, "Win32");
    backendCapabilities = {
      os: "windows",
      icloud: false,
      ai_assistant: false,
      clip_capture: false,
      note_lock: false,
    };

    await render("shortcuts");
    expect(container?.textContent).not.toContain("Capture clipboard");
    expect(container?.textContent).toContain("Command Palette");

    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    await render("privacy");
    expect(container?.textContent).not.toContain("Note Locking");
    expect(container?.textContent).toContain("Analytics");

    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    await render("folders");
    // The iCloud toggle/description block is gone; the generic "sync tip"
    // hint (which lists iCloud Drive as one example of a synced folder) stays.
    expect(container?.querySelector('[title="Toggle iCloud Drive sync"]')).toBeNull();
    expect(container?.textContent).not.toContain(
      "Sync notes between Mac and iPhone via iCloud",
    );
    // Notes directory must stay available without iCloud.
    expect(container?.textContent).toContain("Notes directory");

    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    await render("ai");
    expect(container?.textContent).not.toContain("Enable AI features");
  });
});
