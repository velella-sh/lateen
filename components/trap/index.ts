import { h } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { OctagonX } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";

/** The Markdown directive this component handles: `:::trap`. */
export const directive = "trap";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["title"] as const;

export type TrapProps = {
  /** Replaces the translated "Watch out". */
  title?: string;
};

/** Traps counted per page and page HTML, so ids are the same on every build and never leak between pages. */
const counts = new WeakMap<Page, { html: string; n: number }>();

function nextId(page: Page): string {
  let state = counts.get(page);
  if (state === undefined || state.html !== page.html) {
    state = { html: page.html, n: 0 };
    counts.set(page, state);
  }
  state.n += 1;
  return `trap-title-${String(state.n)}`;
}

/**
 * A trap: a mistake that is easy to make at this point of a guide. It is its own component, not a
 * sixth callout kind. The title is read in the page language unless the author gives one; the icon (a
 * snare, not the warning triangle) and the visible title keep it apart from a warning without colour.
 */
export default function trap({ props, html, page }: ComponentProps<TrapProps>) {
  const custom = typeof props.title === "string" ? props.title.trim() : "";
  const title = custom === "" ? t(page.lang, "guide_trap") : custom;
  const id = nextId(page);

  return h(
    "div",
    { class: "trap", role: "note", "aria-labelledby": id },
    icon({ node: OctagonX, class: "trap-icon" }),
    h(
      "div",
      { class: "trap-content" },
      h("p", { class: "trap-title", id }, title),
      h("div", { class: "trap-body", dangerouslySetInnerHTML: { __html: html } }),
    ),
  );
}
