import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, NavItem } from "@velella/mizzen/contracts";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide";
import { icon } from "../src/icon.ts";
import { highlightFences } from "../src/code.ts";
import base from "./base.ts";

function navItems(items: readonly NavItem[], current: string): ComponentChildren[] {
  return items.map((item) => {
    if ("children" in item) return h("li", { class: "sidebar-group" }, h("h3", null, item.title), h("ul", null, navItems(item.children, current)));
    return h("li", null, h("a", { href: item.url, ...(item.url === current ? { "aria-current": "page" } : {}) }, item.title));
  });
}

function sidebar(props: LayoutProps): ComponentChildren {
  const items = props.site.nav.main ?? [];
  return h("nav", { class: "sidebar-nav", "aria-label": "Documentation" },
    h("h2", null, "Explore"),
    h("ul", null, navItems(items, props.page.url)),
  );
}

function toc(props: LayoutProps): ComponentChildren {
  const headings = props.page.headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
  if (headings.length === 0) return null;
  return h("nav", { class: "toc", "aria-label": "On this page" },
    h("h2", null, "On this page"),
    h("ul", null, headings.map((heading) => h("li", { class: heading.depth === 3 ? "toc-nested" : undefined }, h("a", { href: `#${heading.id}` }, heading.text)))),
  );
}

export default function doc(props: LayoutProps) {
  const { page, pager } = props;
  const description = typeof page.frontMatter.description === "string" ? page.frontMatter.description : undefined;
  return base({ ...props,
    sidebar: sidebar(props),
    aside: toc(props),
    main: h("article", { class: "doc" },
      h("nav", { class: "breadcrumb", "aria-label": "Breadcrumb" },
        h("a", { href: `${props.site.config.base}/` }, "Docs"),
        h(icon, { node: ChevronRight }),
        h("span", { "aria-current": "page" }, page.title),
      ),
      h("header", { class: "doc-header" },
        h("p", { class: "eyebrow" }, "Lateen documentation"),
        h("h1", null, page.title),
        description ? h("p", { class: "doc-description" }, description) : null,
      ),
      h("div", { class: "doc-body", dangerouslySetInnerHTML: { __html: highlightFences(page.html).replace(/<table([^>]*)>/g, '<table$1 tabindex="0" role="region" aria-label="Scrollable table">') } }),
      h("nav", { class: "pager", "aria-label": "Adjacent pages" },
        pager.prev ? h("a", { class: "card", href: pager.prev.url }, h(icon, { node: ArrowLeft }), h("span", null, h("small", null, "Previous"), pager.prev.title)) : h("span", null),
        pager.next ? h("a", { class: "card", href: pager.next.url }, h("span", null, h("small", null, "Next"), pager.next.title), h(icon, { node: ArrowRight })) : null,
      ),
    ),
  });
}
