// The in-page layout checks of the visual gates. The runner calls `checkPage` after each screenshot,
// while the page is still open. Three structural faults are reported, independent of the pixels:
//   overflow      the page scrolls sideways
//   clipped-text  an element hides text of its own with overflow: hidden or clip
//   small-target  a control is smaller than 24 by 24 CSS pixels (WCAG 2.5.8)
// and one typographic one:
//   measure       a prose line is longer than the `measure-max` token, or a paragraph that wraps
//                 is boxed narrower than `measure-min` although its parent has room for it
// Nothing is skipped to make a page pass: an element that must break a rule is listed in EXCEPTIONS
// with the reason, and the list is part of the review.
import type { Page } from "playwright";

export type CheckName = "overflow" | "clipped-text" | "small-target" | "measure";

export interface Finding {
  readonly check: CheckName;
  /** A path to the element that is stable across runs: tag, id, classes and position. */
  readonly selector: string;
  readonly detail: string;
}

export interface PageFinding extends Finding {
  readonly page: string;
  /** The matrix entry the page was checked in, such as `desktop` or `mobile`. */
  readonly entry: string;
}

export interface CheckException {
  readonly check: CheckName;
  readonly selector: string;
  /** Why the element may break the rule. Required: an exception without a reason is not allowed. */
  readonly reason: string;
  /** Page name the exception is limited to; every page when absent. */
  readonly page?: string;
}

/** Reasoned exceptions. Empty on purpose: fix the element first. */
export const EXCEPTIONS: readonly CheckException[] = [];

/** The smallest side of a control, in CSS pixels. */
export const MIN_TARGET = 24;

/**
 * Runs inside the page, so it must not use anything from this module. It returns the findings for
 * the document it runs in. The DOM is reached through `globalThis`, as the repository has no DOM lib.
 */
export function inPageChecks(minTarget: number): Finding[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any;
  const doc = g.document;
  const found: Finding[] = [];

  const selectorOf = (el: any): string => {
    const parts: string[] = [];
    for (let node = el; node && node.nodeType === 1 && node !== doc.documentElement && parts.length < 5; node = node.parentElement) {
      let part = node.localName as string;
      if (node.id) {
        parts.unshift(`${part}#${node.id}`);
        return parts.join(" > ");
      }
      const classes = [...node.classList].slice(0, 2).join(".");
      if (classes) part += `.${classes}`;
      const same = [...(node.parentElement?.children ?? [])].filter((c: any) => c.localName === node.localName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      parts.unshift(part);
    }
    return parts.length === 0 ? "html" : parts.join(" > ");
  };
  const style = (el: any): any => g.getComputedStyle(el);
  const visible = (el: any): boolean => {
    const r = el.getBoundingClientRect();
    const s = style(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const ownText = (el: any): string =>
    [...el.childNodes].filter((n: any) => n.nodeType === 3).map((n: any) => n.textContent).join("").trim();
  const px = (n: number): string => `${Math.round(n * 10) / 10}px`;

  // 1. Horizontal overflow: report the page, then each element that reaches past the viewport
  // unless a scrolling or clipping ancestor holds it.
  const root = doc.documentElement;
  if (root.scrollWidth > root.clientWidth) {
    found.push({ check: "overflow", selector: "html", detail: `page is ${root.scrollWidth}px wide in a ${root.clientWidth}px viewport` });
    const contained = (el: any): boolean => {
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        const ox = style(p).overflowX;
        if (ox !== "visible") return true;
      }
      return false;
    };
    for (const el of doc.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || !visible(el)) continue;
      if ((r.right > root.clientWidth + 1 || r.left < -1) && !contained(el)) {
        found.push({ check: "overflow", selector: selectorOf(el), detail: `reaches ${px(r.left)} to ${px(r.right)} in a ${root.clientWidth}px viewport` });
        if (found.length > 12) break;
      }
    }
  }

  // 2. Clipped text: an element that clips its own overflow while its text does not fit.
  for (const el of doc.body.querySelectorAll("*")) {
    const s = style(el);
    const clipX = s.overflowX === "hidden" || s.overflowX === "clip";
    const clipY = s.overflowY === "hidden" || s.overflowY === "clip";
    if (!clipX && !clipY) continue;
    if (!visible(el) || ownText(el) === "") continue;
    const wide = clipX && el.scrollWidth > el.clientWidth + 1;
    const tall = clipY && el.scrollHeight > el.clientHeight + 1;
    if (el.clientWidth <= 4 || el.clientHeight <= 4) continue; // visually hidden by design
    if (wide || tall) {
      found.push({
        check: "clipped-text",
        selector: selectorOf(el),
        detail: wide ? `text is ${el.scrollWidth}px wide in a ${el.clientWidth}px box` : `text is ${el.scrollHeight}px tall in a ${el.clientHeight}px box`,
      });
    }
  }

  // 3. Controls below minTarget by minTarget. Links inside a run of text are inline targets.
  const controls = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem]";
  for (const el of doc.body.querySelectorAll(controls)) {
    if (!visible(el) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) continue; // visually hidden control (e.g. a skip link at rest)
    // A stacked table blockifies its cells' links, but a link that is a cell's text is still an inline
    // target: its size is set by the line-height of the text around it (WCAG 2.5.8, inline exception).
    const cell = el.parentElement !== null && (el.parentElement.localName === "td" || el.parentElement.localName === "th");
    if (
      el.localName === "a" &&
      (style(el).display === "inline" || cell) &&
      el.closest("p, li, dd, dt, blockquote, figcaption, td, th, h1, h2, h3, h4, h5, h6")
    ) continue;
    if (r.width < minTarget - 0.5 || r.height < minTarget - 0.5) {
      found.push({ check: "small-target", selector: selectorOf(el), detail: `${px(r.width)} by ${px(r.height)}, under ${minTarget} by ${minTarget}` });
    }
  }

  // 4. Measure: the longest rendered line of each prose element against the measure tokens.
  const probe = (el: any, token: string): number => {
    const p = doc.createElement("span");
    p.style.cssText = `position:absolute;visibility:hidden;width:var(${token});height:0;padding:0;border:0`;
    el.appendChild(p);
    const w = p.getBoundingClientRect().width;
    p.remove();
    return w;
  };
  for (const el of doc.body.querySelectorAll("p, li, dd, blockquote")) {
    if (!visible(el) || el.closest("pre, code, nav, table, [aria-hidden=true]")) continue;
    if (ownText(el).length < 40) continue;
    const range = doc.createRange();
    range.selectNodeContents(el);
    const lines = new Map<number, [number, number]>();
    for (const r of range.getClientRects()) {
      if (r.width === 0) continue;
      const key = Math.round(r.top / 4);
      const cur = lines.get(key);
      lines.set(key, cur ? [Math.min(cur[0], r.left), Math.max(cur[1], r.right)] : [r.left, r.right]);
    }
    if (lines.size === 0) continue;
    const longest = Math.max(...[...lines.values()].map(([a, b]) => b - a));
    const max = probe(el, "--measure-max");
    const min = probe(el, "--measure-min");
    if (max > 0 && longest > max + 1) {
      found.push({ check: "measure", selector: selectorOf(el), detail: `longest line is ${px(longest)}, over the measure-max of ${px(max)}` });
    } else if (min > 0 && lines.size >= 3) {
      const s = style(el);
      const box = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      const parent = el.parentElement;
      const room = parent ? parent.clientWidth - parseFloat(style(parent).paddingLeft) - parseFloat(style(parent).paddingRight) : 0;
      if (box < min - 1 && room >= min) {
        found.push({ check: "measure", selector: selectorOf(el), detail: `text is boxed to ${px(box)}, under the measure-min of ${px(min)}, though its parent is ${px(room)} wide` });
      }
    }
  }
  return found;
}

/** True when `exceptions` lists the finding (same check and selector, and page when limited). */
export function isExcepted(finding: Finding, page: string, exceptions: readonly CheckException[]): boolean {
  return exceptions.some((e) => e.reason.trim() !== "" && e.check === finding.check && e.selector === finding.selector && (e.page === undefined || e.page === page));
}

/** Runs every check in the open page and returns what is not a listed exception. */
export async function checkPage(page: Page, name: string, entry: string, exceptions: readonly CheckException[] = EXCEPTIONS): Promise<PageFinding[]> {
  const findings = (await page.evaluate(inPageChecks, MIN_TARGET)) as Finding[];
  return findings.filter((f) => !isExcepted(f, name, exceptions)).map((f) => ({ ...f, page: name, entry }));
}

/** One printable line: the page, the matrix entry, the check, the selector and what is wrong. */
export function formatFinding(f: PageFinding): string {
  return `${f.page} [${f.entry}] ${f.check} ${f.selector}: ${f.detail}`;
}
