import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./formatRelativeDate";

describe("formatRelativeDate", () => {
  const now = new Date(2026, 5, 22, 12, 0, 0);

  it("formats recent dates in English by default", () => {
    expect(formatRelativeDate("20260622-115500", "en", now)).toBe("5 min ago");
  });

  it("formats recent dates in Simplified Chinese", () => {
    expect(formatRelativeDate("20260622-115500", "zh-CN", now)).toBe("5 分钟前");
  });
});
