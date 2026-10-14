import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import PostIt from "./PostIt";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
  startDragging: vi.fn(() => Promise.resolve()),
  scaleFactor: vi.fn(() => Promise.resolve(1)),
  innerSize: vi.fn(() => Promise.resolve({ width: 450, height: 320 })),
  outerPosition: vi.fn(() => Promise.resolve({ x: 10, y: 20 })),
  onMoved: vi.fn(() => Promise.resolve(() => {})),
  onResized: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
  setCursor: vi.fn(),
}));

vi.mock("@codemirror/autocomplete", () => ({
  closeCompletion: vi.fn(),
  completionStatus: vi.fn(() => null),
  startCompletion: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listen,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    startDragging: tauriMocks.startDragging,
    scaleFactor: tauriMocks.scaleFactor,
    innerSize: tauriMocks.innerSize,
    outerPosition: tauriMocks.outerPosition,
    onMoved: tauriMocks.onMoved,
    onResized: tauriMocks.onResized,
    emit: tauriMocks.emit,
  })),
}));

vi.mock("./AiMenu", () => ({
  default: () => null,
}));

vi.mock("./FolderPicker", () => ({
  default: () => null,
}));

vi.mock("./SyncIndicator", () => ({
  default: () => null,
}));

vi.mock("./SpeechButton", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function MockSpeechButton(_props, ref) {
      React.useImperativeHandle(ref, () => ({ toggle: vi.fn() }));
      return null;
    }),
  };
});

vi.mock("./Editor", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function MockEditor(props: any, ref) {
      const [value, setValue] = React.useState(props.initialContent ?? "");
      const valueRef = React.useRef(value);

      React.useEffect(() => {
        valueRef.current = value;
      }, [value]);

      React.useImperativeHandle(ref, () => ({
        focus: vi.fn(),
        clear: () => {
          valueRef.current = "";
          setValue("");
          props.onChange?.("");
        },
        setContent: (next: string) => {
          valueRef.current = next;
          setValue(next);
          props.onChange?.(next);
        },
        moveToEnd: vi.fn(),
        setCursor: tauriMocks.setCursor,
        setVimMode: vi.fn(),
        getView: () => ({
          state: {
            doc: {
              length: valueRef.current.length,
              toString: () => valueRef.current,
            },
            selection: { main: { head: valueRef.current.length } },
          },
          dispatch: vi.fn(),
        }),
      }));

      return React.createElement("textarea", {
        "aria-label": "editor",
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
          const next = event.currentTarget.value;
          valueRef.current = next;
          setValue(next);
          props.onChange?.(next);
        },
      });
    }),
  };
});

const invokeMock = vi.mocked(invoke);

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const settings = {
  locale: "en",
  vim_mode_enabled: false,
  font_size: 14,
  folder_colors: {},
  system_shortcuts: {},
  custom_templates: [],
  text_direction: "auto",
  icloud: { enabled: false },
  dictation: {
    active_model: null,
    active_language: null,
    chinese_script: "simplified",
    enabled: true,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  tauriMocks.startDragging.mockClear();
  invokeMock.mockImplementation((command) => {
    if (command === "get_settings") return Promise.resolve(settings);
    if (command === "list_folders") return Promise.resolve(["Inbox"]);
    if (command === "get_notes_directory") return Promise.resolve("/tmp/Stik");
    if (command === "delete_session_draft") return Promise.resolve(true);
    if (command === "save_cursor_position") return Promise.resolve(true);
    if (command === "upsert_session_draft") return Promise.resolve(null);
    if (command === "save_capture_window_size") return Promise.resolve(true);
    if (command === "save_viewing_window_geometry") return Promise.resolve(true);
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
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function renderRecoveredDraft(overrides: Partial<React.ComponentProps<typeof PostIt>> = {}) {
  if (!container) throw new Error("Missing test container");

  const props: React.ComponentProps<typeof PostIt> = {
    folder: "Inbox",
    onSave: vi.fn(() => Promise.resolve("/tmp/Stik/Inbox/recovered.md")),
    onClose: vi.fn(() => Promise.resolve()),
    onFolderChange: vi.fn(),
    initialContent: "Recovered draft",
    sessionDraftId: "edit:restored",
    sessionDraftKind: "edit",
    sessionDraftOriginalPath: "/tmp/Stik/Inbox/recovered.md",
    isRecoveredSessionDraft: true,
    ...overrides,
  };

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(PostIt, props));
  });

  await act(async () => {
    await Promise.resolve();
  });

  return props;
}

describe("PostIt recovered session drafts", () => {
  it("restores the cursor from the recovered snapshot", async () => {
    await renderRecoveredDraft({ sessionDraftCursor: { head: 4, anchor: 2 } });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(tauriMocks.setCursor).toHaveBeenCalledWith(4, 2);
  });

  it("keeps the normal window chrome and save/drag interactions", async () => {
    const onSave = vi.fn(() => Promise.resolve("/tmp/Stik/Inbox/recovered.md"));
    const onClose = vi.fn(() => Promise.resolve());
    await renderRecoveredDraft({ onSave, onClose });

    expect(document.body.textContent).not.toContain("Discard");
    expect(document.body.textContent).not.toContain("Save");

    const escButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "esc",
    );
    expect(escButton).toBeDefined();

    const header = container!.querySelector(".drag-handle") as HTMLElement;
    await act(async () => {
      header.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(tauriMocks.startDragging).toHaveBeenCalledTimes(1);

    await act(async () => {
      escButton!.click();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith("Recovered draft", "Inbox");
    expect(invokeMock).toHaveBeenCalledWith("delete_session_draft", {
      id: "edit:restored",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the existing Escape save path when vim mode is disabled", async () => {
    const onSave = vi.fn(() => Promise.resolve("/tmp/Stik/Inbox/recovered.md"));
    const onClose = vi.fn(() => Promise.resolve());
    await renderRecoveredDraft({ onSave, onClose });

    const editor = document.querySelector(
      'textarea[aria-label="editor"]',
    ) as HTMLTextAreaElement;

    await act(async () => {
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith("Recovered draft", "Inbox");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
