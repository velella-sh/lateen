import { h } from "preact";
import type { Chrome, NavLink } from "@velella/mizzen/contracts";
import { ChevronRight } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";

/** Chevron pointing toward the current page; `style.css` mirrors it under `dir="rtl"`. Decorative, so it stays out of the accessibility tree. */
function separator() {
  return icon({ node: ChevronRight, class: "breadcrumb-sep" });
}

/** A title shaped like a file path keeps its left-to-right segment order inside the crumb. */
const PATH_SHAPED = /\/|:|\.\p{L}/u;

/**
 * The authored title of a crumb. `<bdi>` isolates its own base direction, so a right-to-left,
 * left-to-right, or neutral-only run cannot reorder the crumbs or separators beside it, and the text
 * and the link's URL are carried through unchanged. A path-shaped title gets an inner left-to-right
 * island so its first right-to-left segment cannot reverse the path.
 */
function title(text: string) {
  return h("bdi", { class: "breadcrumb-title" }, PATH_SHAPED.test(text) ? h("bdi", { dir: "ltr" }, text) : text);
}

/** One crumb: every ancestor is an ordinary keyboard-accessible link, the last item is the current page and is not a link. */
function crumb(link: NavLink, current: boolean) {
  return current
    ? h("span", { "aria-current": "page" }, title(link.title))
    : h("a", { href: link.url }, title(link.title));
}

/** A trail this long keeps only its first and last crumbs on a narrow screen. */
const COLLAPSED_FROM = 4;

/**
 * The collapsed middle of a long trail. `<details>` opens without JavaScript, and the wide-screen
 * rules in `style.css` flatten it back into the row and hide the summary. The middle keeps its own
 * ordered list, so every ancestor is still a link and every crumb is still an item.
 */
function overflow(middle: NavLink[], lang: string) {
  const items = middle.map((link) => h("li", { class: "breadcrumb-item" }, separator(), crumb(link, false)));
  return h(
    "li",
    { class: "breadcrumb-item breadcrumb-overflow" },
    h(
      "details",
      { class: "breadcrumb-details" },
      h(
        "summary",
        { class: "breadcrumb-summary", "aria-label": t(lang, "breadcrumb_more") },
        separator(),
        h("span", { "aria-hidden": "true" }, "…"),
      ),
      h("ol", { class: "breadcrumb-list" }, ...items),
    ),
  );
}

/**
 * The trail from the navigation tree above the title, as one ordered list with one item per crumb so
 * assistive technology can count the crumbs and find the current page. Decorative chevrons stay out of
 * the accessibility tree and each authored title is direction-isolated. Renders nothing without at least
 * one ancestor.
 */
const breadcrumb: Chrome = ({ page, trail }) => {
  if (trail.length < 2) return null;

  const items = [];
  if (trail.length < COLLAPSED_FROM) {
    for (let i = 0; i < trail.length; i += 1) {
      items.push(
        h("li", { class: "breadcrumb-item" }, i > 0 ? separator() : null, crumb(trail[i]!, i === trail.length - 1)),
      );
    }
  } else {
    items.push(h("li", { class: "breadcrumb-item" }, crumb(trail[0]!, false)));
    items.push(overflow(trail.slice(1, -1), page.lang));
    items.push(h("li", { class: "breadcrumb-item" }, separator(), crumb(trail[trail.length - 1]!, true)));
  }

  return h(
    "nav",
    { class: "breadcrumb", "aria-label": t(page.lang, "breadcrumbs") },
    h("ol", { class: "breadcrumb-list" }, ...items),
  );
};

export default breadcrumb;
