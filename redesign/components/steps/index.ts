import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "steps";
export const NUMBER_CLASS = "step-number num";
export const ROOT_ATTRIBUTE = "data-steps";

const DIGITS: Readonly<Record<string, string>> = {
  fa: "۰۱۲۳۴۵۶۷۸۹",
  ar: "٠١٢٣٤٥٦٧٨٩",
};

export function digitsOf(n: number, lang: string): string {
  const set = DIGITS[lang.toLowerCase().split("-")[0] ?? ""];
  if (set === undefined) return String(n);
  return String(n).replace(/\d/g, (digit) => set[Number(digit)] ?? digit);
}

interface Item {
  readonly tagStart: number;
  readonly tagEnd: number;
  readonly close: number;
}

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

export function numberSteps(html: string, lang: string): string {
  const items = itemsOf(html);
  let out = "";
  let cursor = 0;
  items.forEach((item, index) => {
    const n = index + 1;
    const li = `<li id="step-${String(n)}" class="step" data-step="${String(n)}">`;
    const number = `<i class="${NUMBER_CLASS}" aria-hidden="true">${digitsOf(n, lang)}</i>`;
    out += html.slice(cursor, item.tagStart) + li + number;
    cursor = item.tagEnd;
  });
  return out + html.slice(cursor);
}

const steps: Component = ({ html, page }) =>
  h("div", {
    class: "steps steps-ui",
    [ROOT_ATTRIBUTE]: "",
    dangerouslySetInnerHTML: { __html: numberSteps(html, page?.lang ?? "en") },
  });

export default steps;
