import { h } from "preact";
import type { Chrome, NavLink } from "@velella/mizzen/contracts";
import { ArrowLeft, ArrowRight } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";

/** Arrow pointing toward the page it leads to; `style.css` mirrors it under `dir="rtl"`. */
function arrow(kind: "prev" | "next") {
  return icon({ node: kind === "prev" ? ArrowLeft : ArrowRight, class: "pager-arrow" });
}

/**
 * One card: the direction label with its arrow on the outer side, then the title of the linked page.
 * The title is isolated in `<bdi>` so a title facing the other way keeps its own order next to the label.
 */
function card(kind: "prev" | "next", link: NavLink, lang: string) {
  const label = t(lang, kind === "prev" ? "previous" : "next");
  const text = kind === "prev" ? [arrow(kind), label] : [label, arrow(kind)];
  return h(
    "a",
    { class: `pager-link pager-${kind}`, href: link.url, rel: kind },
    h("span", { class: "pager-label" }, ...text),
    h("span", { class: "pager-title" }, h("bdi", {}, link.title)),
  );
}

/** Previous and next pages in reading order; renders nothing when the page has neither. */
const pager: Chrome = ({ page, pager: { prev, next } }) => {
  if (prev === undefined && next === undefined) return null;

  return h(
    "nav",
    { class: "pager", "aria-label": t(page.lang, "pager") },
    prev === undefined ? null : card("prev", prev, page.lang),
    next === undefined ? null : card("next", next, page.lang),
  );
};

export default pager;
