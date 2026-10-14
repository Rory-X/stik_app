/**
 * CodeMirror theme for Stik — matches the existing design tokens.
 * Source-mode markdown editing with syntax highlighting.
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { highlightTag } from "./cm-highlight";

export const CODE_BLOCK_HIGHLIGHT_COLORS = {
  comment: "var(--editor-code-token-comment)",
  keyword: "var(--editor-code-token-keyword)",
  definitionKeyword: "var(--editor-code-token-definition-keyword)",
  string: "var(--editor-code-token-string)",
  number: "var(--editor-code-token-number)",
  function: "var(--editor-code-token-function)",
  definition: "var(--editor-code-token-definition)",
  type: "var(--editor-code-token-type)",
  property: "var(--editor-code-token-property)",
  variable: "var(--editor-code-block-text)",
  operator: "var(--editor-code-token-operator)",
  punctuation: "var(--editor-code-token-punctuation)",
  regexp: "var(--editor-code-token-regexp)",
  escape: "var(--editor-code-token-escape)",
  invalid: "var(--editor-code-token-invalid)",
  label: "var(--editor-code-token-label)",
} as const;

/** Base editor theme — layout, scrolling, placeholder */
export const stikEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--editor-font-size, 14px)",
    color: "rgb(var(--color-ink))",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--editor-font-family, inherit)",
    lineHeight: "1.5",
  },
  ".cm-content": {
    padding: "12px 16px",
    caretColor: "rgb(var(--color-coral))",
    minHeight: "100%",
  },
  "&.cm-focused .cm-content": {
    outline: "none",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "rgb(var(--color-coral))",
    borderLeftWidth: "2px",
  },
  ".cm-dropCursor": {
    borderLeftColor: "rgba(var(--color-coral), 0.35)",
    borderLeftWidth: "1px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(232, 112, 95, 0.15) !important",
  },
  ".cm-selectionLayer": {
    zIndex: "20 !important",
    pointerEvents: "none",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(232, 112, 95, 0.2) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-placeholder": {
    color: "var(--editor-placeholder)",
    fontStyle: "normal",
  },
  // Wiki-link decorations
  ".cm-wikilink": {
    color: "rgb(var(--color-coral))",
    textDecoration: "underline",
    textDecorationStyle: "dashed",
    textUnderlineOffset: "2px",
    textDecorationThickness: "1px",
    cursor: "pointer",
    padding: "0 1px",
    borderRadius: "2px",
    transition: "background-color 0.15s",
  },
  ".cm-wikilink:hover": {
    backgroundColor: "rgba(232, 112, 95, 0.1)",
  },
  // Autocomplete panel
  ".cm-tooltip-autocomplete": {
    border: "1px solid rgb(var(--color-line))",
    borderRadius: "10px",
    backgroundColor: "rgb(var(--color-bg))",
    boxShadow: "var(--shadow-stik)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul": {
    padding: "4px",
    maxHeight: "240px",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    color: "rgb(var(--color-ink))",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "rgb(var(--color-line))",
    color: "rgb(var(--color-ink))",
  },
  ".cm-completionLabel": {
    fontWeight: "500",
  },
  ".cm-completionDetail": {
    fontSize: "10px",
    fontWeight: "600",
    color: "rgb(var(--color-coral))",
    backgroundColor: "rgba(232, 112, 95, 0.1)",
    padding: "1px 6px",
    borderRadius: "99px",
    marginLeft: "8px",
  },
  // Search panel
  ".cm-panels": {
    backgroundColor: "rgb(var(--color-bg))",
    borderBottom: "1px solid rgb(var(--color-line))",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(232, 112, 95, 0.2)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(232, 112, 95, 0.35)",
  },
  // Horizontal rule widget
  ".cm-hr-widget": {
    border: "none",
    borderTop: "1px solid rgb(var(--color-line))",
    margin: "8px 0",
  },
  // Table widget
  ".cm-table-widget": {
    position: "relative",
    border: "1px solid rgb(var(--color-line))",
    borderRadius: "6px",
    overflow: "hidden",
    margin: "4px 0",
  },
  ".cm-table-widget table": {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "inherit",
  },
  ".cm-table-widget th": {
    backgroundColor: "rgba(var(--color-ink), 0.05)",
    fontWeight: "600",
    textAlign: "left",
    padding: "6px 12px",
    borderBottom: "1px solid rgb(var(--color-line))",
  },
  ".cm-table-widget td": {
    padding: "6px 12px",
    borderBottom: "1px solid rgb(var(--color-line))",
  },
  ".cm-table-widget tr:last-child td": {
    borderBottom: "none",
  },
  ".cm-table-widget th + th, .cm-table-widget td + td": {
    borderLeft: "1px solid rgb(var(--color-line))",
  },
  // Editable cell focus
  ".cm-table-cell:focus": {
    outline: "none",
    boxShadow: "inset 0 0 0 2px rgb(var(--color-coral))",
  },
  // Add row button — inside widget, full-width bar at bottom
  ".cm-table-add-row": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "28px",
    border: "none",
    borderTop: "1px solid rgb(var(--color-line))",
    backgroundColor: "transparent",
    color: "rgb(var(--color-stone))",
    fontSize: "14px",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 0.15s, background-color 0.15s",
  },
  ".cm-table-widget:hover .cm-table-add-row": {
    opacity: "1",
  },
  ".cm-table-add-row:hover": {
    backgroundColor: "rgba(232, 112, 95, 0.1)",
    color: "rgb(var(--color-coral))",
  },
  // Add column button — vertical bar on right edge
  ".cm-table-add-col": {
    position: "absolute",
    right: "0",
    top: "0",
    bottom: "0",
    width: "28px",
    border: "none",
    borderLeft: "1px solid rgb(var(--color-line))",
    backgroundColor: "transparent",
    color: "rgb(var(--color-stone))",
    fontSize: "14px",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 0.15s, background-color 0.15s",
  },
  ".cm-table-widget:hover .cm-table-add-col": {
    opacity: "1",
  },
  ".cm-table-add-col:hover": {
    backgroundColor: "rgba(232, 112, 95, 0.1)",
    color: "rgb(var(--color-coral))",
  },
  // Table context menu (right-click)
  ".cm-table-context-menu": {
    position: "absolute",
    zIndex: "1000",
    backgroundColor: "rgb(var(--color-bg))",
    border: "1px solid rgb(var(--color-line))",
    borderRadius: "8px",
    padding: "4px 0",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
    minWidth: "160px",
  },
  ".cm-table-menu-item": {
    display: "block",
    width: "100%",
    padding: "6px 12px",
    border: "none",
    backgroundColor: "transparent",
    color: "rgb(var(--color-ink))",
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
    lineHeight: "1.4",
  },
  ".cm-table-menu-item:hover": {
    backgroundColor: "rgba(232, 112, 95, 0.1)",
    color: "rgb(var(--color-coral))",
  },
  ".cm-table-menu-disabled": {
    opacity: "0.35",
    cursor: "default",
    pointerEvents: "none",
  },
  ".cm-table-menu-sep": {
    height: "1px",
    backgroundColor: "rgb(var(--color-line))",
    margin: "4px 0",
  },
  // Inline image widget
  ".cm-image-widget": {
    display: "inline-block",
    position: "relative",
    maxWidth: "100%",
    margin: "4px 0",
    lineHeight: "0",
    userSelect: "none",
  },
  ".cm-image-widget img": {
    maxWidth: "100%",
    height: "auto",
    borderRadius: "6px",
    display: "block",
    transition: "filter 120ms ease, transform 120ms ease",
  },
  ".cm-image-widget img:hover": {
    filter: "brightness(0.94)",
  },
  ".cm-image-preview-button": {
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "1px solid rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    color: "white",
    fontSize: "18px",
    lineHeight: "24px",
    fontWeight: "600",
    cursor: "pointer",
    opacity: "0",
    transform: "translateY(-2px)",
    transition: "opacity 120ms ease, transform 120ms ease, background-color 120ms ease",
    pointerEvents: "none",
  },
  ".cm-image-widget:hover .cm-image-preview-button, .cm-image-preview-button:focus": {
    opacity: "1",
    transform: "translateY(0)",
    pointerEvents: "auto",
  },
  ".cm-image-preview-button:hover": {
    backgroundColor: "rgba(20, 20, 20, 0.9)",
  },
  ".cm-image-widget.cm-image-error": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "48px",
    border: "1px dashed rgb(var(--color-line))",
    borderRadius: "6px",
    padding: "8px 12px",
  },
  ".cm-image-error-text": {
    fontSize: "12px",
    color: "rgb(var(--color-stone))",
    lineHeight: "1.4",
  },
  ".cm-codeblock-header": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    margin: "10px 0 0 0",
    padding: "6px 8px 6px 10px",
    backgroundColor: "var(--editor-code-block-header-bg)",
    border: "1px solid var(--editor-code-block-border)",
    borderBottom: "none",
    borderRadius: "7px 7px 0 0",
    fontFamily: "var(--font-sans, inherit)",
    boxSizing: "border-box",
  },
  ".cm-codeblock-language": {
    maxWidth: "160px",
    minWidth: "112px",
    height: "26px",
    padding: "0 8px",
    border: "1px solid var(--editor-code-block-control-border)",
    borderRadius: "5px",
    backgroundColor: "var(--editor-code-block-control-bg)",
    color: "var(--editor-code-block-control-text)",
    fontSize: "11px",
    fontWeight: "600",
    lineHeight: "1",
    outline: "none",
  },
  ".cm-codeblock-language:focus": {
    borderColor: "rgb(var(--color-coral))",
    boxShadow: "0 0 0 2px rgba(var(--color-coral), 0.16)",
  },
  ".cm-codeblock-copy": {
    height: "26px",
    padding: "0 9px",
    border: "1px solid var(--editor-code-block-control-border)",
    borderRadius: "5px",
    backgroundColor: "var(--editor-code-block-control-bg)",
    color: "var(--editor-code-block-control-text)",
    fontSize: "11px",
    fontWeight: "600",
    lineHeight: "1",
    cursor: "pointer",
  },
  ".cm-codeblock-copy:hover": {
    color: "var(--editor-code-block-text)",
    backgroundColor: "var(--editor-code-block-control-hover-bg)",
  },
  // Fenced code block lines (live preview)
  ".cm-fenced-code": {
    backgroundColor: "var(--editor-code-block-bg)",
    color: "var(--editor-code-block-text)",
    fontFamily: "Monaco, Consolas, monospace",
    fontSize: "0.88em",
    lineHeight: "1.58",
    margin: "0",
    padding: "0 12px",
    borderLeft: "1px solid var(--editor-code-block-border)",
    borderRight: "1px solid var(--editor-code-block-border)",
    boxSizing: "border-box",
    tabSize: "2",
  },
  ".cm-fenced-code-first": {
    borderRadius: "0",
    paddingTop: "8px",
  },
  ".cm-fenced-code-last": {
    borderBottom: "1px solid var(--editor-code-block-border)",
    borderRadius: "0 0 7px 7px",
    paddingBottom: "8px",
  },
  // Collapsed fence line — content replaced within line, CSS collapses height.
  // Keeps DOM flow intact (no newline-crossing replace decorations).
  ".cm-fenced-fence-hidden": {
    fontSize: "0",
    lineHeight: "0",
    height: "0",
    overflow: "hidden",
    padding: "0 !important",
    margin: "0 !important",
  },
});

/** Syntax highlighting for markdown source mode.
 *
 * Key insight: @lezer/markdown uses "/..." selectors (e.g. "BulletList/...")
 * which tag ALL descendants, not just markers. So `tags.list` applies to the
 * entire list item content. We intentionally DON'T style `tags.list` to avoid
 * coloring all list text. List markers (-, *, 1.) are separately tagged as
 * `tags.processingInstruction` and get muted styling there.
 */
export const stikHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    // Headings — bold, slightly larger
    { tag: tags.heading1, fontWeight: "700", fontSize: "1.43em" },
    { tag: tags.heading2, fontWeight: "600", fontSize: "1.21em" },
    { tag: tags.heading3, fontWeight: "600", fontSize: "1.07em" },
    // Markdown syntax markers (#, **, *, ~~, `, [, ], -, 1.)
    // No fontWeight override — let markers inherit weight from their context
    // (e.g. # inside a heading stays bold, ** stays normal)
    { tag: tags.processingInstruction, color: "rgb(var(--color-stone))" },
    // Bold
    { tag: tags.strong, fontWeight: "700" },
    // Italic
    { tag: tags.emphasis, fontStyle: "italic" },
    // Strikethrough
    {
      tag: tags.strikethrough,
      textDecoration: "line-through",
      color: "var(--editor-strikethrough)",
    },
    // Inline code
    {
      tag: tags.monospace,
      fontFamily: "Monaco, Consolas, monospace",
      fontSize: "0.86em",
      backgroundColor: "var(--editor-code-bg)",
      padding: "1px 4px",
      borderRadius: "3px",
    },
    // Links
    { tag: tags.link, color: "var(--editor-link)", textDecoration: "underline" },
    { tag: tags.url, color: "var(--editor-link)" },
    // Code block syntax tokens
    { tag: tags.comment, color: CODE_BLOCK_HIGHLIGHT_COLORS.comment, fontStyle: "italic" },
    { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: CODE_BLOCK_HIGHLIGHT_COLORS.keyword, fontWeight: "700" },
    { tag: [tags.definitionKeyword, tags.modifier, tags.operatorKeyword], color: CODE_BLOCK_HIGHLIGHT_COLORS.definitionKeyword, fontWeight: "700" },
    { tag: [tags.string, tags.character, tags.attributeValue], color: CODE_BLOCK_HIGHLIGHT_COLORS.string },
    { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom], color: CODE_BLOCK_HIGHLIGHT_COLORS.number, fontWeight: "600" },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: CODE_BLOCK_HIGHLIGHT_COLORS.function, fontWeight: "700" },
    { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: CODE_BLOCK_HIGHLIGHT_COLORS.definition },
    { tag: [tags.typeName, tags.className, tags.tagName], color: CODE_BLOCK_HIGHLIGHT_COLORS.type, fontWeight: "700" },
    { tag: [tags.propertyName, tags.attributeName], color: CODE_BLOCK_HIGHLIGHT_COLORS.property },
    { tag: [tags.variableName, tags.name], color: CODE_BLOCK_HIGHLIGHT_COLORS.variable },
    { tag: [tags.operator, tags.compareOperator, tags.logicOperator, tags.definitionOperator], color: CODE_BLOCK_HIGHLIGHT_COLORS.operator, fontWeight: "600" },
    { tag: [tags.punctuation, tags.bracket, tags.separator], color: CODE_BLOCK_HIGHLIGHT_COLORS.punctuation },
    { tag: tags.regexp, color: CODE_BLOCK_HIGHLIGHT_COLORS.regexp },
    { tag: tags.escape, color: CODE_BLOCK_HIGHLIGHT_COLORS.escape, fontWeight: "700" },
    { tag: tags.invalid, color: CODE_BLOCK_HIGHLIGHT_COLORS.invalid, textDecoration: "underline wavy var(--editor-code-token-invalid)" },
    // Block quote content (all descendants of Blockquote)
    { tag: tags.quote, color: "var(--editor-blockquote-text)", fontStyle: "italic" },
    // ==highlight== text
    {
      tag: highlightTag,
      backgroundColor: "var(--editor-highlight-bg)",
      borderRadius: "2px",
    },
    // Task markers: [ ] and [x]
    { tag: tags.atom, color: "rgb(var(--color-stone))" },
    // Meta / syntax chars
    { tag: tags.meta, color: "rgb(var(--color-stone))" },
    // HTML angle brackets
    { tag: tags.angleBracket, color: "rgb(var(--color-stone))" },
    // Code language labels (```javascript)
    { tag: tags.labelName, color: CODE_BLOCK_HIGHLIGHT_COLORS.label },
  ])
);
