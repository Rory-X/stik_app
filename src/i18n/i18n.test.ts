import { describe, expect, it } from "vitest";
import { createTranslator, getMissingLocaleKeys, resolveLocale } from "./index";
import { translateBackendError } from "./errors";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

describe("i18n dictionaries", () => {
  it("keeps Simplified Chinese and English locale keys in sync", () => {
    expect(getMissingLocaleKeys(en, zhCN)).toEqual([]);
    expect(getMissingLocaleKeys(zhCN, en)).toEqual([]);
  });

  it("resolves unsupported or empty persisted locales to English", () => {
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("")).toBe("en");
    expect(resolveLocale("fr-FR")).toBe("en");
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
  });

  it("translates common dialog actions and replacement text", () => {
    const t = createTranslator("zh-CN");

    expect(t("common.delete")).toBe("删除");
    expect(t("common.unlock")).toBe("解锁");
    expect(t("common.confirm")).toBe("确认");
    expect(t("command.toast.openFailed", { error: "no file" })).toBe(
      "无法打开笔记：no file",
    );
  });

  it("translates AI and dictation setup surfaces", () => {
    const t = createTranslator("zh-CN");

    expect(t("ai.rephrase")).toBe("改写");
    expect(t("ai.settings.title")).toBe("启用 AI 功能");
    expect(t("ai.toast.summaryApplied")).toBe("摘要已应用");
    expect(t("dictation.setup.title")).toBe("设置语音输入");
    expect(t("dictation.settings.models")).toBe("模型");
  });

  it("translates main settings sections", () => {
    const t = createTranslator("zh-CN");

    expect(t("settings.appearance.createCustomTheme")).toBe("创建自定义主题");
    expect(t("settings.templates.addTemplate")).toBe("添加模板");
    expect(t("settings.shortcuts.systemShortcuts")).toBe("系统快捷键");
    expect(t("settings.folders.notesDirectory")).toBe("笔记目录");
    expect(t("settings.editor.fontSize")).toBe("字体大小");
    expect(t("settings.git.enable")).toBe("启用 Git 共享");
    expect(t("settings.insights.captureStreak")).toBe("连续记录");
  });

  it("translates common backend errors for Chinese UI", () => {
    const t = createTranslator("zh-CN");

    expect(translateBackendError("Folder does not exist", t)).toBe(
      "文件夹不存在",
    );
    expect(
      translateBackendError(
        "Failed to delete note: Operation not permitted",
        t,
      ),
    ).toBe("删除笔记失败：Operation not permitted");
    expect(translateBackendError("DarwinKit sidecar not running", t)).toBe(
      "DarwinKit 后台服务未运行",
    );
    expect(
      translateBackendError("Remote URL is required for Git sharing", t),
    ).toBe("Git 共享需要远程 URL");
    expect(translateBackendError("Not authenticated", t)).toBe("尚未认证");
    expect(
      translateBackendError("Failed to query notes: database is locked", t),
    ).toBe("查询 Apple Notes 失败：database is locked");
    expect(
      translateBackendError("Invalid JSON theme file: expected value", t),
    ).toBe("JSON 主题文件无效：expected value");
    expect(
      translateBackendError("Clipboard unavailable: denied", t),
    ).toBe("剪贴板不可用：denied");
    expect(translateBackendError("Operation not permitted (os error 1)", t)).toBe(
      "没有操作权限",
    );
  });
});
