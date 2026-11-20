import { h } from "preact";
import type { Chrome, Heading } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** Id of the visible heading that names the navigation landmark. */
const TITLE_ID = "toc-title";

/** Headings the TOC shows: `h2` and `h3` only, in document order. */
function entries(headings: readonly Heading[]): Heading[] {
  return headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
}

function link(heading: Heading) {
  return h("a", { href: `#${heading.id}` }, heading.text);
}

/** Nested list for the sticky column: each `h2` may wrap following `h3`s. */
function nestedList(items: readonly Heading[]) {
  const nodes = [];
  for (let i = 0; i < items.length; ) {
    const item = items[i]!;
    if (item.depth === 2) {
      const children = [];
      i += 1;
      while (i < items.length && items[i]!.depth === 3) {
        children.push(h("li", null, link(items[i]!)));
        i += 1;
      }
      nodes.push(h("li", null, link(item), children.length > 0 ? h("ul", null, children) : null));
    } else {
      nodes.push(h("li", null, link(item)));
      i += 1;
    }
  }
  return h("ul", null, nodes);
}

/** Flat list for the narrow-screen `<details>` block. */
function flatList(items: readonly Heading[]) {
  return h(
    "ul",
    null,
    items.map((item) => h("li", null, link(item))),
  );
}

/** On this page: the sticky navigation landmark shown beside the article on wide screens. */
const toc: Chrome = ({ page }) => {
  const items = entries(page.headings);
  if (items.length < 2) return null;
  const label = t(page.lang, "on_this_page");

  return h("nav", { class: "toc", "aria-labelledby": TITLE_ID }, h("h2", { id: TITLE_ID }, label), nestedList(items));
};

/**
 * The same entries in a native `<details>` at the start of the article. Closed by default and fully
 * usable without JavaScript; `ui.css` shows it below the aside breakpoint and hides it above it.
 */
export const tocFold: Chrome = ({ page }) => {
  const items = entries(page.headings);
  if (items.length < 2) return null;

  return h(
    "details",
    { class: "toc-fold" },
    h("summary", null, t(page.lang, "on_this_page")),
    flatList(items),
  );
};

export default toc;
