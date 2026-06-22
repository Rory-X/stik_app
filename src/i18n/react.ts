import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { StikSettings } from "@/types";
import { createTranslator, resolveLocale, type Locale } from "./index";

export function useI18n() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    let cancelled = false;

    invoke<StikSettings>("get_settings")
      .then((settings) => {
        if (!cancelled) setLocale(resolveLocale(settings.locale));
      })
      .catch(() => {});

    const unlisten = listen<StikSettings>("settings-changed", (event) => {
      setLocale(resolveLocale(event.payload.locale));
    });

    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  return { locale, t };
}
