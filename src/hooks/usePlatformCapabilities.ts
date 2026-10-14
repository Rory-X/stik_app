import { useEffect, useState } from "react";
import type { PlatformCapabilities } from "@/types";
import {
  guessPlatformCapabilities,
  loadPlatformCapabilities,
} from "@/utils/platformCapabilities";

/**
 * Platform feature flags for the current platform.
 *
 * The first render uses the synchronous user-agent guess so macOS-only UI
 * never flashes on Windows (and macOS UI never flickers out on macOS), then
 * the backend answer replaces it once `get_platform_capabilities` resolves.
 */
export function usePlatformCapabilities(): PlatformCapabilities {
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(
    guessPlatformCapabilities,
  );

  useEffect(() => {
    let cancelled = false;

    loadPlatformCapabilities().then((loaded) => {
      if (!cancelled) setCapabilities(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return capabilities;
}
