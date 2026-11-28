/// <reference lib="dom" />
// The "unstyled element" check (epic design-audit, #1256; issue design-audit-5). It runs in a
// Playwright page and reports elements that still carry browser defaults where the theme has a rule,
// and elements that stick out of the header or the viewport. It reads computed styles and boxes only:
// it makes no claim about how a page looks. `org-sites-1` exports it from `visual/index.ts`.
import type { Page } from "playwright";

/** The rules the check reports, one id each. */
export const RULES = [
  "caption-centered",
  "table-border-model",
  "dl-without-grid",
  "container-without-layout",
  "sr-text-visible",
  "header-overflow",
  "viewport-overflow",
] as const;

export type UnstyledRule = (typeof RULES)[number];

/** A box in CSS pixels, relative to the page's top-left corner. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One finding: where it is, which rule it breaks and its box. */
export interface UnstyledFinding {
  readonly selector: string;
  readonly rule: UnstyledRule;
  readonly box: Box;
}

/** A container that must lay its children out as `display`; a plain block is the browser default. */
export interface LayoutExpectation {
  readonly selector: string;
  readonly display: readonly string[];
}

/** The containers the theme lays out with a grid or flex rule. A site adds its own. */
export const LAYOUT_CONTAINERS: readonly LayoutExpectation[] = [{ selector: ".api-page", display: ["grid"] }];

export interface UnstyledOptions {
  /** Containers that must not be a plain block. Defaults to {@link LAYOUT_CONTAINERS}. */
  readonly containers?: readonly LayoutExpectation[];
  /** Selector of the header whose box nothing may leave. Defaults to the first `header`. */
  readonly header?: string;
}

/**
 * Finds the unstyled elements of the page the browser has open. Call it after the page has settled.
 * Elements that are hidden (`display: none`, `visibility: hidden`, no box) are never reported.
 */
export async function findUnstyled(page: Page, options: UnstyledOptions = {}): Promise<UnstyledFinding[]> {
  const containers = options.containers ?? LAYOUT_CONTAINERS;
  const header = options.header ?? "header";
  return page.evaluate(scan, { containers: containers.map((c) => ({ selector: c.selector, display: [...c.display] })), header });
}

/** Runs inside the page: no imports, no references to the module scope. */
function scan(input: { containers: { selector: string; display: string[] }[]; header: string }): UnstyledFinding[] {
  const found: UnstyledFinding[] = [];
  const seen = new Set<string>();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const visible = (element: Element): boolean => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const selectorOf = (element: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = element; node !== null && node !== document.documentElement; node = node.parentElement) {
      if (node.id !== "") {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const first = node.classList.item(0);
      const same = node.parentElement === null ? [] : Array.from(node.parentElement.children).filter((c) => c.tagName === node.tagName);
      const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : "";
      parts.unshift(`${tag}${first === null ? "" : `.${CSS.escape(first)}`}${nth}`);
    }
    return parts.join(" > ");
  };

  const report = (element: Element, rule: UnstyledRule): void => {
    const selector = selectorOf(element);
    const key = `${rule}|${selector}`;
    if (seen.has(key)) return;
    seen.add(key);
    const rect = element.getBoundingClientRect();
    found.push({
      selector,
      rule,
      box: { x: Math.round(rect.x + scrollX), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  };

  // A caption the browser centres: the theme aligns captions to the start.
  for (const caption of document.querySelectorAll("caption")) {
    if (visible(caption) && /center/.test(getComputedStyle(caption).textAlign)) report(caption, "caption-centered");
  }

  // A table with the browser's separate border model and its 2px spacing.
  for (const table of document.querySelectorAll("table")) {
    const style = getComputedStyle(table);
    if (visible(table) && style.borderCollapse === "separate" && style.borderSpacing !== "0px") report(table, "table-border-model");
  }

  // A definition list that is still a plain block.
  for (const list of document.querySelectorAll("dl")) {
    if (visible(list) && getComputedStyle(list).display === "block") report(list, "dl-without-grid");
  }

  // A layout container that is still a plain block.
  for (const { selector, display } of input.containers) {
    for (const container of document.querySelectorAll(selector)) {
      if (visible(container) && !display.includes(getComputedStyle(container).display)) report(container, "container-without-layout");
    }
  }

  // Text meant for screen readers only that is drawn on the page: a class named `sr`/`sr-only` with a real box.
  for (const element of document.querySelectorAll("[class]")) {
    const named = Array.from(element.classList).some((name) => /(^|-)sr(-only)?$/.test(name));
    if (!named || !visible(element)) continue;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const clipped = style.clip !== "auto" || style.clipPath !== "none" || (rect.width <= 1 && rect.height <= 1);
    if (!clipped) report(element, "sr-text-visible");
  }

  // Anything that leaves the header's box, or the viewport's width.
  const bar = document.querySelector(input.header);
  const viewport = document.documentElement.clientWidth;
  const outside = new Set<Element>();
  const scrolls = (element: Element): boolean => {
    for (let node = element.parentElement; node !== null; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll" || overflow === "hidden" || overflow === "clip") return true;
    }
    return false;
  };
  if (bar !== null && visible(bar)) {
    const box = bar.getBoundingClientRect();
    for (const element of bar.querySelectorAll("*")) {
      if (!visible(element) || element instanceof SVGElement) continue;
      if (getComputedStyle(element).position === "fixed") continue;
      const rect = element.getBoundingClientRect();
      if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.left < -1 || rect.right > viewport + 1) outside.add(element);
    }
  }
  for (const element of outside) {
    let ancestor = element.parentElement;
    let nested = false;
    for (; ancestor !== null; ancestor = ancestor.parentElement) if (outside.has(ancestor)) nested = true;
    if (!nested) report(element, "header-overflow");
  }
  for (const element of document.body.querySelectorAll("*")) {
    if (bar?.contains(element) === true || element instanceof SVGElement || !visible(element)) continue;
    if (getComputedStyle(element).position === "fixed" || scrolls(element)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.right > viewport + 1 || rect.left < -1) report(element, "viewport-overflow");
  }
  return found;
}
