import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, NavItem } from "@velella/mizzen/contracts";
import { highlightFences } from "../src/code.ts";
import base from "./base.ts";

function navItems(items: readonly NavItem[], current: string): ComponentChildren[] {
  return items.map((item) => {
    if ("children" in item) {
      return [
        h("h2", null, item.title),
        ...navItems(item.children, current),
      ];
    }
    return h("a", {
      href: item.url,
      ...(item.url === current ? { "aria-current": "page" } : {}),
    }, item.title);
  });
}

function sidebar(props: LayoutProps): ComponentChildren {
  const items = props.site.nav.main ?? [];
  return h("nav", { class: "sidebar-nav side", "aria-label": "Documentation" },
    ...navItems(items, props.page.url),
  );
}

function toc(props: LayoutProps): ComponentChildren {
  const headings = props.page.headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
  if (headings.length === 0) return null;
  return h("nav", { class: "toc", "aria-label": "On this page" },
    h("h2", null, "On this page"),
    headings.map((heading) => h("a", {
      href: `#${heading.id}`,
      class: heading.depth === 3 ? "toc-nested" : undefined,
    }, heading.text)),
  );
}

function crumb(props: LayoutProps): ComponentChildren {
  const base = props.site.config.base;
  const section = props.page.url.includes("/components/")
    ? { title: "Components", url: `${base}/components/` }
    : props.page.url.includes("/tokens/")
      ? { title: "Customize", url: `${base}/tokens/` }
      : { title: "Start", url: `${base}/` };
  return h("p", { class: "crumb breadcrumb" },
    h("a", { href: section.url }, section.title),
    " / ",
    props.page.title,
  );
}

export default function doc(props: LayoutProps) {
  const { page, pager } = props;
  const description = typeof page.frontMatter.description === "string" ? page.frontMatter.description : undefined;
  return base({
    ...props,
    sidebar: sidebar(props),
    aside: toc(props),
    main: h("article", { class: "doc" },
      crumb(props),
      h("header", { class: "doc-header" },
        h("h1", null, page.title),
        description ? h("p", { class: "doc-description dek" }, description) : null,
      ),
      h("div", {
        class: "doc-body",
        dangerouslySetInnerHTML: {
          __html: highlightFences(page.html).replace(
            /<table([^>]*)>/g,
            '<table$1 tabindex="0" role="region" aria-label="Scrollable table">',
          ),
        },
      }),
      h("nav", { class: "pager", "aria-label": "Adjacent pages" },
        pager.prev
          ? h("a", { href: pager.prev.url }, h("small", null, "Previous"), pager.prev.title)
          : h("span", null),
        pager.next
          ? h("a", { class: "next", href: pager.next.url }, h("small", null, "Next"), pager.next.title)
          : null,
      ),
    ),
  });
}
