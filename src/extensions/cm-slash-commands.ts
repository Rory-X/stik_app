/**
 * Slash commands for CodeMirror — Notion/Raycast-style "/" templates.
 *
 * Type "/" at line start (or after whitespace) to trigger a dropdown of
 * markdown templates. Picks insert the template and position the cursor.
 * Uses CM6's built-in autocomplete system — no new dependencies.
 */

import {
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import type { CustomTemplate } from "@/types";
import type { Locale } from "@/i18n";

interface SlashTemplate {
  command: string;
  badge: string;
  boost: number;
  insert: () => { text: string; cursor: number | [number, number] };
}

/** Built-in command names — used for validation (no duplicates with custom). */
export const BUILTIN_COMMAND_NAMES: readonly string[] = [
  "h1", "h2", "h3", "list", "numbered", "todo",
  "divider", "code", "quote", "table", "link", "image",
  "meeting", "standup", "journal", "brainstorm", "retro", "proscons", "weekly",
];

/** Returns all active slash command names (built-in + custom). */
export function getSlashCommandNames(): string[] {
  return [
    ...BUILTIN_COMMAND_NAMES,
    ...customTemplates.map((t) => t.command),
  ];
}

/** Resolve dynamic placeholders in template text at insertion time. */
function resolvePlaceholders(text: string, locale: Locale = slashCommandLocale): string {
  const now = new Date();
  const date = now.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = now.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    weekday: "long",
  });
  const isodate = now.toISOString().slice(0, 10);

  return text
    .replace(/\{\{datetime\}\}/g, `${date} ${time}`)
    .replace(/\{\{isodate\}\}/g, isodate)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{day\}\}/g, day);
}

// ── Custom templates (set at runtime from settings) ────────────────

let customTemplates: SlashTemplate[] = [];
let slashCommandLocale: Locale = "en";

export function setSlashCommandLocale(locale: Locale | null | undefined): void {
  slashCommandLocale = locale === "zh-CN" ? "zh-CN" : "en";
}

function isChineseLocale(locale: Locale = slashCommandLocale): boolean {
  return locale === "zh-CN";
}

function slashBadge(key: "heading" | "list" | "tasks" | "code" | "quote" | "table" | "link" | "image" | "template" | "custom", locale: Locale = slashCommandLocale): string {
  if (!isChineseLocale(locale)) {
    const en: Record<typeof key, string> = {
      heading: "Heading",
      list: "List",
      tasks: "Tasks",
      code: "Code",
      quote: "Quote",
      table: "Table",
      link: "Link",
      image: "Image",
      template: "Template",
      custom: "Custom",
    };
    return en[key];
  }

  const zh: Record<typeof key, string> = {
    heading: "标题",
    list: "列表",
    tasks: "任务",
    code: "代码",
    quote: "引用",
    table: "表格",
    link: "链接",
    image: "图片",
    template: "模板",
    custom: "自定义",
  };
  return zh[key];
}

/** Convert user-defined templates into SlashTemplates with {{cursor}} support. */
export function setCustomTemplates(templates: CustomTemplate[]): void {
  customTemplates = templates.map((t) => ({
    command: t.name,
    badge: slashBadge("custom"),
    boost: -1,
    insert: () => {
      const resolved = resolvePlaceholders(t.body, slashCommandLocale);
      const idx = resolved.indexOf("{{cursor}}");
      if (idx >= 0) {
        return { text: resolved.replace("{{cursor}}", ""), cursor: idx };
      }
      return { text: resolved, cursor: resolved.length };
    },
  }));
}

// ── Built-in templates ─────────────────────────────────────────────

function builtinTemplates(locale: Locale = slashCommandLocale): SlashTemplate[] {
  const zh = isChineseLocale(locale);
  return [
  {
    command: "h1",
    badge: slashBadge("heading", locale),
    boost: 0,
    insert: () => ({ text: "# ", cursor: 2 }),
  },
  {
    command: "h2",
    badge: slashBadge("heading", locale),
    boost: 0,
    insert: () => ({ text: "## ", cursor: 3 }),
  },
  {
    command: "h3",
    badge: slashBadge("heading", locale),
    boost: 0,
    insert: () => ({ text: "### ", cursor: 4 }),
  },
  {
    command: "list",
    badge: slashBadge("list", locale),
    boost: 0,
    insert: () => ({ text: "- \n- \n- ", cursor: 2 }),
  },
  {
    command: "numbered",
    badge: slashBadge("list", locale),
    boost: 0,
    insert: () => ({ text: "1. \n2. \n3. ", cursor: 3 }),
  },
  {
    command: "todo",
    badge: slashBadge("tasks", locale),
    boost: 0,
    insert: () => ({ text: "- [ ] \n- [ ] \n- [ ] ", cursor: 6 }),
  },
  {
    command: "divider",
    badge: "---",
    boost: 0,
    insert: () => ({ text: "---\n", cursor: 4 }),
  },
  {
    command: "code",
    badge: slashBadge("code", locale),
    boost: 0,
    insert: () => ({ text: "```\n\n```", cursor: 4 }),
  },
  {
    command: "quote",
    badge: slashBadge("quote", locale),
    boost: 0,
    insert: () => ({ text: "> ", cursor: 2 }),
  },
  {
    command: "table",
    badge: slashBadge("table", locale),
    boost: 0,
    insert: () => ({
      text: zh
        ? "| 列 1 | 列 2 |\n| --- | --- |\n|  |  |\n\n"
        : "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n\n",
      cursor: 38, // inside first data cell (after "| ")
    }),
  },
  {
    command: "link",
    badge: slashBadge("link", locale),
    boost: 0,
    insert: () =>
      zh
        ? { text: "[文本](url)", cursor: [1, 3] }
        : { text: "[text](url)", cursor: [1, 5] },
  },
  {
    command: "image",
    badge: slashBadge("image", locale),
    boost: 0,
    insert: () =>
      zh
        ? { text: "![描述](url)", cursor: [2, 4] }
        : { text: "![alt](url)", cursor: [2, 5] },
  },

  // ── Note templates ──────────────────────────────────────────────
  {
    command: "meeting",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = resolvePlaceholders(
        zh
          ? "# 会议 - {{date}}\n\n参会人：\n\n## 议程\n\n- \n\n## 记录\n\n- \n\n## 行动项\n\n- [ ] "
          : "# Meeting - {{date}}\n\nAttendees: \n\n## Agenda\n\n- \n\n## Notes\n\n- \n\n## Action Items\n\n- [ ] ",
        locale,
      );
      const anchor = zh ? "参会人：" : "Attendees: ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  {
    command: "standup",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = resolvePlaceholders(
        zh
          ? "# 站会 - {{day}}，{{date}}\n\n## 昨天\n\n- \n\n## 今天\n\n- \n\n## 阻碍\n\n- "
          : "# Standup - {{day}}, {{date}}\n\n## Yesterday\n\n- \n\n## Today\n\n- \n\n## Blockers\n\n- ",
        locale,
      );
      const anchor = zh ? "## 昨天\n\n- " : "## Yesterday\n\n- ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  {
    command: "journal",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = resolvePlaceholders(
        zh
          ? "# {{day}}，{{date}}\n\n## 感恩\n\n- \n\n## 正在思考\n\n- \n\n## 今日收获\n\n- \n\n"
          : "# {{day}}, {{date}}\n\n## Grateful for\n\n- \n\n## On my mind\n\n- \n\n## Today's wins\n\n- \n\n",
        locale,
      );
      return { text, cursor: text.length };
    },
  },
  {
    command: "brainstorm",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = zh
        ? "# 头脑风暴：\n\n## 想法\n\n- \n\n## 候选\n\n- \n\n## 下一步\n\n- "
        : "# Brainstorm: \n\n## Ideas\n\n- \n\n## Favorites\n\n- \n\n## Next Steps\n\n- ";
      const anchor = zh ? "# 头脑风暴：" : "# Brainstorm: ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  {
    command: "retro",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = resolvePlaceholders(
        zh
          ? "# 复盘 - {{date}}\n\n## 做得好\n\n- \n\n## 可改进\n\n- \n\n## 行动项\n\n- [ ] "
          : "# Retro - {{date}}\n\n## Went well\n\n- \n\n## Could improve\n\n- \n\n## Action items\n\n- [ ] ",
        locale,
      );
      const anchor = zh ? "## 做得好\n\n- " : "## Went well\n\n- ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  {
    command: "proscons",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = zh
        ? "# 决策：\n\n## 优点\n\n- \n\n## 缺点\n\n- \n\n## 结论\n\n"
        : "# Decision: \n\n## Pros\n\n- \n\n## Cons\n\n- \n\n## Verdict\n\n";
      const anchor = zh ? "# 决策：" : "# Decision: ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  {
    command: "weekly",
    badge: slashBadge("template", locale),
    boost: -1,
    insert: () => {
      const text = resolvePlaceholders(
        zh
          ? "# {{date}} 周计划\n\n## 目标\n\n- [ ] \n- [ ] \n- [ ] \n\n## 进展\n\n- \n\n## 反思\n\n"
          : "# Week of {{date}}\n\n## Goals\n\n- [ ] \n- [ ] \n- [ ] \n\n## Progress\n\n- \n\n## Reflections\n\n",
        locale,
      );
      const anchor = zh ? "## 目标\n\n- [ ] " : "## Goals\n\n- [ ] ";
      return { text, cursor: text.indexOf(anchor) + anchor.length };
    },
  },
  ];
}

export function insertBuiltinSlashTemplate(command: string, locale: Locale = "en") {
  return builtinTemplates(locale).find((template) => template.command === command)?.insert() ?? null;
}

/**
 * CompletionSource for slash commands.
 * Triggers when "/" appears at line start or after only whitespace.
 */
export function slashCommandCompletionSource(
  context: CompletionContext
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);

  // Match "/" preceded by nothing or whitespace only
  const match = textBefore.match(/^(\s*)\//);
  if (!match) return null;

  const slashPos = line.from + match[1].length; // position of the "/"
  const typed = textBefore.slice(match[1].length + 1); // chars after "/"

  const allTemplates = [...builtinTemplates(), ...customTemplates];

  // Filter templates by typed prefix
  const filtered = allTemplates.filter((t) =>
    t.command.startsWith(typed.toLowerCase())
  );
  if (!filtered.length) return null;

  const options: Completion[] = filtered.map((t) => ({
    label: `/${t.command}`,
    detail: t.badge,
    boost: t.boost,
    apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
      const { text, cursor } = t.insert();
      const changes = { from, to, insert: text };

      if (Array.isArray(cursor)) {
        // Selection range (e.g. select "text" in [text](url))
        view.dispatch({
          changes,
          selection: { anchor: from + cursor[0], head: from + cursor[1] },
        });
      } else {
        view.dispatch({
          changes,
          selection: { anchor: from + cursor },
        });
      }
    },
  }));

  return {
    from: slashPos,
    to: context.pos,
    options,
    filter: false, // we handle filtering ourselves
  };
}
