import { describe, expect, it } from "vitest";
import { normalizeChineseScript } from "./chineseScript";

describe("normalizeChineseScript", () => {
  it("converts common Traditional Chinese dictation output to Simplified Chinese", () => {
    expect(
      normalizeChineseScript("語音輸入識別出來的是繁體中文", "simplified"),
    ).toBe("语音输入识别出来的是繁体中文");

    expect(
      normalizeChineseScript(
        "設定裡選擇中文後，內容會顯示為繁體。",
        "simplified",
      ),
    ).toBe("设置里选择中文后，内容会显示为繁体。");
  });

  it("preserves model output when requested", () => {
    expect(normalizeChineseScript("語音輸入", "preserve")).toBe("語音輸入");
  });

  it("can convert common Simplified Chinese text to Traditional Chinese", () => {
    expect(normalizeChineseScript("语音输入", "traditional")).toBe("語音輸入");
  });

  it("defaults invalid or missing preferences to Simplified Chinese", () => {
    expect(normalizeChineseScript("設定", undefined)).toBe("设置");
    expect(normalizeChineseScript("設定", "invalid")).toBe("设置");
  });
});
