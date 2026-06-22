import { describe, expect, it } from "vitest";
import {
  IMAGE_PREVIEW_REQUEST_EVENT,
  bindImagePreviewElement,
  createImagePreviewRequestEvent,
} from "./imagePreviewEvent";

describe("imagePreviewEvent", () => {
  it("creates a bubbling event with the image source and alt text", () => {
    const event = createImagePreviewRequestEvent({
      src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
      alt: "pasted screenshot",
    });

    expect(event.type).toBe(IMAGE_PREVIEW_REQUEST_EVENT);
    expect(event.bubbles).toBe(true);
    expect(event.detail).toEqual({
      src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
      alt: "pasted screenshot",
    });
  });

  it("normalizes missing alt text to an empty string", () => {
    const event = createImagePreviewRequestEvent({
      src: "https://example.com/image.png",
    });

    expect(event.detail).toEqual({
      src: "https://example.com/image.png",
      alt: "",
    });
  });

  it("dispatches preview on mousedown before the editor can reveal markdown source", () => {
    const parent = document.createElement("div");
    const img = document.createElement("img");
    parent.appendChild(img);

    const previews: unknown[] = [];
    const originalMouseEvents: string[] = [];
    parent.addEventListener(IMAGE_PREVIEW_REQUEST_EVENT, (event) => {
      previews.push((event as CustomEvent).detail);
    });
    parent.addEventListener("mousedown", () => {
      originalMouseEvents.push("mousedown");
    });

    bindImagePreviewElement(img, {
      src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
      alt: "pasted screenshot",
    });

    const mouseEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    img.dispatchEvent(mouseEvent);

    expect(previews).toEqual([
      {
        src: "https://asset.localhost/tmp/Stik/Inbox/.assets/pasted.png",
        alt: "pasted screenshot",
      },
    ]);
    expect(mouseEvent.defaultPrevented).toBe(true);
    expect(originalMouseEvents).toEqual([]);
  });

});
