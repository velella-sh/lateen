import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** The Markdown directive this component handles: `:::before-after`. */
export const directive = "before-after";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["removed", "added"] as const;

export type BeforeAfterProps = {
  /** Line numbers of the Before block to mark as removed: `2,4-6`. */
  removed?: string;
  /** Line numbers of the After block to mark as added: `1,3`. */
  added?: string;
};

/** The sign each mark shows; it is text, so the mark does not rely on colour. */
export const SIGNS = { removed: "−", added: "+" } as const;

/** The text of an HTML fragment: tags dropped and the common entities read back. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, "&");
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The code of every `pre` in the HTML, in order, with the language of its `language-*` class. */
export function blocksOf(html: string): { code: string; lang: string }[] {
  const blocks: { code: string; lang: string }[] = [];
  for (const match of html.matchAll(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi)) {
    const lang = /\blanguage-([\w-]+)/.exec(match[1] ?? "")?.[1] ?? "";
    blocks.push({ code: textOf(match[2] ?? "").replace(/\n$/, ""), lang });
  }
  return blocks;
}

/** Line numbers from `2,4-6`; anything that is not a number or a range is ignored. */
export function lineSet(value: unknown): Set<number> {
  const lines = new Set<number>();
  if (typeof value !== "string") return lines;
  for (const part of value.split(",")) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (match === null) continue;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    for (let n = from; n <= Math.min(to, from + 10_000); n += 1) lines.add(n);
  }
  return lines;
}

function pane(kind: "before" | "after", code: string, lang: string, marked: ReadonlySet<number>, pageLang: string) {
  const sign = kind === "before" ? SIGNS.removed : SIGNS.added;
  const markName = kind === "before" ? "removed" : "added";
  const label = t(pageLang, kind === "before" ? "guide_before" : "guide_after");
  const lines = code.split("\n").map((line, index) => {
    const on = marked.has(index + 1);
    return h(
      "span",
      { class: on ? `ba-line ba-${markName}` : "ba-line", ...(on ? { "data-mark": markName } : {}) },
      h("span", { class: "ba-sign", "aria-hidden": on ? undefined : "true" }, on ? sign : " "),
      h("span", { class: "ba-text" }, line === "" ? "​" : line),
      "\n",
    );
  });
  return h(
    "figure",
    { class: `ba-pane ba-${kind}` },
    h(
      "figcaption",
      { class: "ba-caption" },
      h("span", { class: "ba-label" }, label),
      h(
        "button",
        {
          type: "button",
          class: "ba-copy",
          hidden: true,
          "data-before-after-copy": "",
          "data-text": code,
          "data-copied": t(pageLang, "copied"),
          "data-copy-failed": t(pageLang, "copy_failed"),
          "aria-label": t(pageLang, kind === "before" ? "guide_copy_before" : "guide_copy_after"),
        },
        t(pageLang, "copy"),
      ),
    ),
    h("pre", { class: "ba-code", tabindex: 0, dir: "ltr" }, h("code", lang === "" ? {} : { class: `language-${lang}` }, ...lines)),
  );
}

/**
 * Two code blocks, labelled Before and After. The author writes both as fenced blocks inside the
 * directive; nothing is diffed. Lines named in `removed` (Before) and `added` (After) carry a sign
 * and a style, so the mark survives without colour, and the sign is left out of a copy. On wide screens
 * the panes sit side by side; on narrow ones they stack. Each has its own copy button, shown by the island.
 */
export default function beforeAfter({ props, html, page }: ComponentProps<BeforeAfterProps>) {
  const [before, after] = blocksOf(html);
  if (before === undefined || after === undefined) {
    return h("div", { class: "before-after", dangerouslySetInnerHTML: { __html: html } });
  }
  return h(
    "div",
    { class: "before-after", "data-before-after": "" },
    pane("before", before.code, before.lang, lineSet(props.removed), page.lang),
    pane("after", after.code, after.lang, lineSet(props.added), page.lang),
  );
}
