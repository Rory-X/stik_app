export const IMAGE_PREVIEW_MIN_ZOOM = 0.25;
export const IMAGE_PREVIEW_MAX_ZOOM = 6;
export const IMAGE_PREVIEW_ZOOM_STEP = 1.25;

export function clampImagePreviewZoom(zoom: number): number {
  return Math.min(
    IMAGE_PREVIEW_MAX_ZOOM,
    Math.max(IMAGE_PREVIEW_MIN_ZOOM, zoom),
  );
}

export function stepImagePreviewZoom(zoom: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? zoom * IMAGE_PREVIEW_ZOOM_STEP
      : zoom / IMAGE_PREVIEW_ZOOM_STEP;
  return Number(clampImagePreviewZoom(next).toFixed(2));
}

export function imagePreviewZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
