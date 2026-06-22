import { describe, expect, it } from "vitest";
import {
  clampImagePreviewZoom,
  imagePreviewZoomPercent,
  stepImagePreviewZoom,
} from "./imagePreviewZoom";

describe("imagePreviewZoom", () => {
  it("clamps zoom between the supported minimum and maximum", () => {
    expect(clampImagePreviewZoom(0.05)).toBe(0.25);
    expect(clampImagePreviewZoom(1.5)).toBe(1.5);
    expect(clampImagePreviewZoom(12)).toBe(6);
  });

  it("steps zoom in consistent increments", () => {
    expect(stepImagePreviewZoom(1, 1)).toBe(1.25);
    expect(stepImagePreviewZoom(1, -1)).toBe(0.8);
    expect(stepImagePreviewZoom(5.8, 1)).toBe(6);
  });

  it("formats zoom as a whole percentage", () => {
    expect(imagePreviewZoomPercent(1)).toBe("100%");
    expect(imagePreviewZoomPercent(1.25)).toBe("125%");
  });
});
