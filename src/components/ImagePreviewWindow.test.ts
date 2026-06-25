import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import ImagePreviewWindow from "./ImagePreviewWindow";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    close: vi.fn(),
    startDragging: vi.fn(),
  })),
}));

const invokeMock = vi.mocked(invoke);

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  invokeMock.mockImplementation((command) => {
    if (command === "get_settings") {
      return Promise.resolve({ locale: "en" });
    }
    if (command === "get_image_preview_content") {
      return Promise.resolve({
        src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
        alt: "pasted",
      });
    }
    if (command === "copy_preview_image_to_clipboard") {
      return Promise.resolve(undefined);
    }
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
  vi.clearAllMocks();
});

async function renderPreviewWindow() {
  if (!container) throw new Error("Missing test container");

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(ImagePreviewWindow));
  });

  await vi.waitFor(() => {
    expect(container?.querySelector("img")).not.toBeNull();
  });
}

describe("ImagePreviewWindow context menu", () => {
  it("copies the original preview image source from the context menu", async () => {
    await renderPreviewWindow();

    const img = container!.querySelector("img")!;
    await act(async () => {
      img.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 48,
          clientY: 64,
        }),
      );
    });

    const copyButton = await vi.waitFor(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Copy image",
      );
      expect(button).toBeDefined();
      return button as HTMLButtonElement;
    });

    await act(async () => {
      copyButton.click();
    });

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("copy_preview_image_to_clipboard", {
        src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
      });
    });
  });
});
