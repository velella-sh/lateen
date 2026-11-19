import { h } from "preact";
import { File } from "lucide";
import { iconHtml } from "../../src/icon.ts";
import { escapeHtml } from "./escape.ts";

/** Class on the file name bar above a code block. */
export const TITLE_CLASS = "code-title";

/** The bar's insides: a decorative file icon and the escaped name. */
function titleInner(name: string): string {
  const icon = iconHtml({ node: File, class: `${TITLE_CLASS}-icon` });
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
