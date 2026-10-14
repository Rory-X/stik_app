export type WindowType =
  | "postit"
  | "capture"
  | "session-draft"
  | "image-preview"
  | "sticked"
  | "settings"
  | "command-palette"
  | "apple-notes-picker"
  | "editor";

export interface WindowInfo {
  type: WindowType;
  id?: string;
  viewing?: boolean;
  folder?: string;
  autoStartDictation?: boolean;
}

export function resolveWindowInfo(search: string): WindowInfo {
  const params = new URLSearchParams(search);
  const windowType = params.get("window");

  if (windowType === "sticked") {
    return {
      type: "sticked",
      id: params.get("id") || undefined,
      viewing: params.get("viewing") === "true",
    };
  }

  if (windowType === "capture") {
    return { type: "capture", folder: params.get("folder") || undefined, autoStartDictation: params.get("startDictation") === "1" };
  }
  if (windowType === "session-draft") return { type: "session-draft", id: params.get("id") || undefined };
  if (windowType === "image-preview") return { type: "image-preview" };
  if (windowType === "settings") return { type: "settings" };
  if (["search", "manager", "command-palette"].includes(windowType ?? "")) {
    return { type: "command-palette" };
  }
  if (windowType === "editor") return { type: "editor" };
  if (windowType === "apple-notes-picker") {
    return { type: "apple-notes-picker" };
  }

  return { type: "postit" };
}
