import type { en } from "./locales/en";

export type Locale = "en" | "zh-CN";
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
