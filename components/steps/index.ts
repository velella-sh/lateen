import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** The Markdown directive this component handles: `:::steps`. */
export const directive = "steps";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = [] as const;

/** Class on the number inside a step; the number is text, not a CSS counter, so agents read it. */
export const NUMBER_CLASS = "step-number";

/** Selector the island finds a step list by. */
export const ROOT_ATTRIBUTE = "data-steps";

/** Digits for the pages that do not use Western ones. */
const DIGITS: Readonly<Record<string, string>> = {
  fa: "۰۱۲۳۴۵۶۷۸۹",
  ar: "٠١٢٣٤٥٦٧٨٩",
};

/** A number written with the digits of the page language: Persian and Arabic pages get their own. */
export function digitsOf(n: number, lang: string): string {
  const set = DIGITS[lang.toLowerCase().split("-")[0] ?? ""];
  if (set === undefined) return String(n);
  return String(n).replace(/\d/g, (digit) => set[Number(digit)] ?? digit);
}

/** The text of an HTML fragment: tags dropped, the common entities read back, space collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The step's title: its first paragraph, or its text up to the first nested block. */
function titleOf(inner: string): string {
  const paragraph = /^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(inner);
  if (paragraph !== null) return textOf(paragraph[1] ?? "");
  const lead = inner.split(/<(?:p|pre|ul|ol|div|aside|figure|table|blockquote)\b/i)[0] ?? "";
  return textOf(lead);
}

/** One top-level step found in the list: where its `<li>` tag and its content sit in the HTML. */
interface Item {
  readonly tagStart: number;
  readonly tagEnd: number;
  readonly close: number;
}

/** The `<li>` of the first top-level `<ol>`, with nested lists skipped. */
function itemsOf(html: string): Item[] {
  const items: Item[] = [];
  const tags = /<(\/?)(ol|ul|li)\b[^>]*>/gi;
  let depth = 0;
  let open: { tagStart: number; tagEnd: number } | undefined;
  let liDepth = 0;
  let started = false;
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (name === "li") {
      if (!closing) {
        if (depth === 1 && started) {
          open = { tagStart: match.index, tagEnd: match.index + match[0].length };
          liDepth = 1;
        } else if (open !== undefined) liDepth += 1;
      } else if (open !== undefined) {
        liDepth -= 1;
        if (liDepth === 0) {
          items.push({ ...open, close: match.index });
          open = undefined;
        }
      }
    } else if (!closing) {
      depth += 1;
      if (name === "ol" && depth === 1) started = true;
    } else {
      depth -= 1;
      if (depth === 0 && started) break;
    }
  }
  return items;
}

/** One step's markup details, for tests and for agents. */
export interface Step {
  readonly number: number;
  readonly id: string;
  readonly title: string;
}

/** The steps of a rendered list in order: number, stable anchor `step-<n>`, and title. */
export function stepsOf(html: string): Step[] {
  return itemsOf(html).map((item, index) => ({
    number: index + 1,
    id: `step-${String(index + 1)}`,
    title: titleOf(html.slice(item.tagEnd, item.close)),
  }));
}

/**
 * Gives every step a stable anchor (`step-1`, `step-2`, …) and its number as text, written with the
 * page's digits. The list stays an ordered list. A step may hold code and callouts: its content is not
 * changed, only the number is put in front of it.
 */
export function numberSteps(html: string, lang: string): string {
  const items = itemsOf(html);
  let out = "";
  let cursor = 0;
  items.forEach((item, index) => {
    const n = index + 1;
    const label = t(lang, "guide_step", { n: digitsOf(n, lang) });
    const li = `<li id="step-${String(n)}" class="step" data-step="${String(n)}">`;
    const number = `<span class="${NUMBER_CLASS}">${label}</span>`;
    out += html.slice(cursor, item.tagStart) + li + number;
    cursor = item.tagEnd;
  });
  return out + html.slice(cursor);
}

/**
 * Numbered steps. The directive's body (an ordered list) is wrapped in `.steps`; every step gets a
 * stable anchor and its number as text in the page's digits ("Step ۱" on a Persian page). `style.css`
 * draws the badges and the line between them, and `client.ts` adds an optional tick per step.
 */
const steps: Component = ({ html, page }) =>
  h("div", {
    class: "steps",
    [ROOT_ATTRIBUTE]: "",
    "data-progress": t(page?.lang ?? "en", "guide_progress", { done: "{done}", total: "{total}" }),
    "data-tick": t(page?.lang ?? "en", "guide_tick", { n: "{n}" }),
    dangerouslySetInnerHTML: { __html: numberSteps(html, page?.lang ?? "en") },
  });

export default steps;
