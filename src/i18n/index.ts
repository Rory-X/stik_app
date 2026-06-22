import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import type { Locale, MessageKey, Messages } from "./types";

export type { Locale, MessageKey, Messages };

export const LOCALES: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
};

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh-CN"];

export function resolveLocale(value: unknown): Locale {
  return value === "zh-CN" || value === "en" ? value : "en";
}

export function getMissingLocaleKeys(
  source: Record<string, string>,
  target: Record<string, string>,
): string[] {
  return Object.keys(source)
    .filter((key) => !(key in target))
    .sort();
}

export function createTranslator(locale: unknown) {
  const resolved = resolveLocale(locale);
  const messages = LOCALES[resolved];

  return (key: MessageKey, replacements?: Record<string, string | number>) => {
    let message = messages[key] ?? en[key] ?? key;
    if (replacements) {
      for (const [name, value] of Object.entries(replacements)) {
        message = message.split(`{${name}}`).join(String(value));
      }
    }
    return message;
  };
}
