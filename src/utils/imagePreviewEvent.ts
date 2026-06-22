export const IMAGE_PREVIEW_REQUEST_EVENT = "stik:image-preview-request";

export interface ImagePreviewPayload {
  src: string;
  alt: string;
}

export function createImagePreviewRequestEvent({
  src,
  alt = "",
}: {
  src: string;
  alt?: string;
}): CustomEvent<ImagePreviewPayload> {
  return new CustomEvent<ImagePreviewPayload>(IMAGE_PREVIEW_REQUEST_EVENT, {
    bubbles: true,
    detail: { src, alt },
  });
}

export function bindImagePreviewElement(
  element: HTMLElement,
  payload: ImagePreviewPayload,
  options: { events?: Array<"mousedown" | "contextmenu"> } = {},
): void {
  const events = options.events ?? ["mousedown"];
  const dispatchPreview = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    element.dispatchEvent(createImagePreviewRequestEvent(payload));
  };

  for (const eventName of events) {
    element.addEventListener(eventName, dispatchPreview);
  }
}
