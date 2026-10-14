import { invoke } from "@tauri-apps/api/core";
import type { PlatformCapabilities } from "@/types";

/** Capability keys that the backend reports as booleans. */
const CAPABILITY_KEYS = [
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

function capabilitiesFor(os: string, enabled: boolean): PlatformCapabilities {
  const capabilities = { os } as PlatformCapabilities;
  for (const key of CAPABILITY_KEYS) {
    capabilities[key] = enabled;
  }
  return capabilities;
}

/**
 * Synchronous best guess from the user agent.
 *
 * Windows and Linux builds ship without the macOS-only features, so anything
 * that is not obviously Windows/Linux is treated as macOS (where every
 * capability is available).
 */
export function guessPlatformCapabilities(): PlatformCapabilities {
  const navigatorRef = typeof navigator === "undefined" ? undefined : navigator;
  const haystack = `${navigatorRef?.userAgent ?? ""} ${
    navigatorRef?.platform ?? ""
  }`.toLowerCase();

  if (/windows|win32|win64|wow64/.test(haystack)) {
    return capabilitiesFor("windows", false);
  }
  if (/linux|x11|android|cros/.test(haystack)) {
    return capabilitiesFor("linux", false);
  }
  return capabilitiesFor("macos", true);
}

/** Keep the backend answer, falling back per-field to the UA guess. */
function mergeCapabilities(raw: unknown): PlatformCapabilities {
  const fallback = guessPlatformCapabilities();
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Record<string, unknown>;
  const merged: PlatformCapabilities = {
    ...fallback,
    os: typeof record.os === "string" ? record.os : fallback.os,
  };
  for (const key of CAPABILITY_KEYS) {
    const value = record[key];
    if (typeof value === "boolean") merged[key] = value;
  }
  return merged;
}

let capabilitiesPromise: Promise<PlatformCapabilities> | null = null;

/**
 * Ask the backend which features this platform supports.
 *
 * The result is cached at module level so every window issues exactly one
 * `get_platform_capabilities` call; if the call fails the UA guess is used.
 */
export function loadPlatformCapabilities(): Promise<PlatformCapabilities> {
  if (!capabilitiesPromise) {
    capabilitiesPromise = invoke<PlatformCapabilities>(
      "get_platform_capabilities",
    )
      .then((raw) => mergeCapabilities(raw))
      .catch(() => guessPlatformCapabilities());
  }
  return capabilitiesPromise;
}

/** Drop the cached result. Test-only. */
export function resetPlatformCapabilitiesCache(): void {
  capabilitiesPromise = null;
}
