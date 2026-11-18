import { h } from "preact";
import { escapeHtml } from "./escape.ts";

/** Class on the file name bar above a code block. */
export const TITLE_CLASS = "code-title";

/** A file outline on a 16 by 16 grid, drawn with strokes so it takes the text color. */
const FILE_PATH: readonly string[] = ["M4 1.5h5.5L13 5v9.5H4Z", "M9.5 1.5V5H13"];

/** The bar's insides: a decorative file icon and the escaped name. */
function titleInner(name: string): string {
  const paths = FILE_PATH.map((d) => `<path d="${d}"></path>`).join("");
  const icon = `<svg class="${TITLE_CLASS}-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  return `${icon}<span class="${TITLE_CLASS}-name">${escapeHtml(name)}</span>`;
}

/**
 * The file name bar as HTML, for a rendered body that is a string rather than a component tree.
 * Empty when the title is missing or blank, so a block without one gets no bar.
 */
export function codeTitleHtml(title: string | null | undefined): string {
  const name = title?.trim() ?? "";
  if (name === "") return "";
  return `<div class="${TITLE_CLASS}">${titleInner(name)}</div>`;
}

/**
 * The file name bar above a code block: a file icon and the `title="…"` of the fence. Returns `undefined`
 * when the title is missing or blank, so a block without one gets no bar. The icon is decorative; the name
 * is the bar's only text.
 */
export function codeTitle(title: string | null | undefined) {
  const name = title?.trim() ?? "";
  if (name === "") return undefined;
  return h("div", { class: TITLE_CLASS, dangerouslySetInnerHTML: { __html: titleInner(name) } });
}
