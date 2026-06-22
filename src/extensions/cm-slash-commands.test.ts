import { describe, expect, it } from "vitest";
import { insertBuiltinSlashTemplate } from "./cm-slash-commands";

describe("slash command built-in templates", () => {
  it("inserts localized Chinese standup template content", () => {
    const result = insertBuiltinSlashTemplate("standup", "zh-CN");

    expect(result?.text).toContain("# 站会");
    expect(result?.text).toContain("## 昨天");
    expect(result?.text).toContain("## 今天");
    expect(result?.text).toContain("## 阻碍");
  });

  it("keeps English template content for English locale", () => {
    const result = insertBuiltinSlashTemplate("standup", "en");

    expect(result?.text).toContain("# Standup");
    expect(result?.text).toContain("## Yesterday");
  });
});
