import { h } from "preact";
import type { Chrome, NavItem, NavLink, Site } from "@velella/mizzen/contracts";
import { ArrowLeft, ArrowRight } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";

/** Arrow pointing toward the page it leads to; `style.css` mirrors it under `dir="rtl"`. */
function arrow(kind: "prev" | "next") {
  return icon({ node: kind === "prev" ? ArrowLeft : ArrowRight, class: "pager-arrow" });
}

/** True when a navigation list holds a leaf at `url`. */
function holds(items: readonly NavItem[], url: string): boolean {
  return items.some((item) => ("url" in item ? item.url === url : holds(item.children, url)));
}

/** The title of the top-level navigation group that holds `url`. */
function sectionOf(site: Site, url: string): string | undefined {
  for (const items of Object.values(site.nav)) {
    for (const item of items) {
      if ("children" in item && holds(item.children, url)) return item.title;
    }
  }
  return undefined;
}

/**
 * One card: the direction label with its arrow on the outer side, then the title of the linked page.
 * The title is isolated in `<bdi>` so a title facing the other way keeps its own order next to the label.
 * A destination in another section names that section after the direction word.
 */
function card(kind: "prev" | "next", link: NavLink, lang: string, section?: string) {
  const label = t(lang, kind === "prev" ? "previous" : "next");
  const sectionText =
    section === undefined ? null : h("span", { class: "pager-section" }, " · ", h("bdi", {}, section));
  const text = kind === "prev" ? [arrow(kind), label, sectionText] : [label, sectionText, arrow(kind)];
  return h(
    "a",
    { class: `pager-link pager-${kind}`, href: link.url, rel: kind },
    h("span", { class: "pager-label" }, ...text),
    h("span", { class: "pager-title" }, h("bdi", {}, link.title)),
  );
}

/** Previous and next pages in reading order; renders nothing when the page has neither. */
const pager: Chrome = ({ page, site, trail, pager: { prev, next } }) => {
  if (prev === undefined && next === undefined) return null;

  const current = trail[0]?.title;
  const section = (url: string): string | undefined => {
    const name = sectionOf(site, url);
    return name === undefined || name === current ? undefined : name;
  };

  return h(
    "nav",
    { class: "pager", "aria-label": t(page.lang, "pager") },
    prev === undefined ? null : card("prev", prev, page.lang, section(prev.url)),
    next === undefined ? null : card("next", next, page.lang, section(next.url)),
  );
};

export default pager;
