import { h } from "preact";
import type { ChromeProps } from "@velella/mizzen/contracts";
import { CodeXml, Menu, Moon, Sailboat, Search, Sun, X } from "lucide";
import { icon } from "../../src/icon.ts";

export default function shell({ site, page }: ChromeProps) {
  const base = site.config.base;
  const pages = site.pages.map((entry) => ({ title: entry.title, description: String(entry.frontMatter.description ?? ""), url: entry.url }));
  const navigation = [
    { title: "Install", url: `${base}/install/` },
    { title: "Layouts", url: `${base}/layouts/` },
    { title: "Components", url: `${base}/components/` },
    { title: "Customize", url: `${base}/tokens/` },
  ];
  return h("header", { class: "site-header" },
    h("div", { class: "header-inner" },
      h("a", { class: "brand", href: `${base}/` },
        h("span", { class: "brand-mark" }, h(icon, { node: Sailboat })),
        h("span", null, "Lateen"),
        h("span", { class: "brand-tag" }, "next"),
      ),
      h("nav", { class: "top-nav", "aria-label": "Main navigation" }, navigation.map((item) =>
        h("a", { href: item.url, ...(page.url === item.url ? { "aria-current": "page" } : {}) }, item.title),
      )),
      h("div", { class: "header-actions" },
        h("button", { type: "button", class: "btn", "data-variant": "ghost", "data-size": "icon", "aria-label": "Search documentation", "data-search-open": true, hidden: true }, h(icon, { node: Search })),
        h("button", { type: "button", class: "btn theme-toggle", "data-variant": "ghost", "data-size": "icon", "aria-label": "Toggle color theme", "data-theme-toggle": true, hidden: true },
          h("span", { class: "theme-sun" }, h(icon, { node: Sun })),
          h("span", { class: "theme-moon" }, h(icon, { node: Moon })),
        ),
        h("a", { class: "btn header-github", "data-variant": "ghost", "data-size": "icon", href: "https://github.com/velella-sh/lateen", "aria-label": "GitHub repository" }, h(icon, { node: CodeXml })),
        h("details", { class: "mobile-nav" },
          h("summary", { class: "btn", "data-variant": "ghost", "data-size": "icon", "aria-label": "Open navigation" }, h(icon, { node: Menu })),
          h("nav", { "aria-label": "Mobile navigation" }, navigation.map((item) => h("a", { href: item.url }, item.title))),
        ),
      ),
    ),
    h("dialog", { class: "search-dialog", "data-search-dialog": true, "aria-labelledby": "search-title" },
      h("div", { class: "search-box" },
        h("div", { class: "search-input-row" },
          h(icon, { node: Search }),
          h("label", { id: "search-title", for: "site-search" }, "Search documentation"),
          h("button", { type: "button", class: "btn", "data-variant": "ghost", "data-size": "icon", "aria-label": "Close search", "data-search-close": true }, h(icon, { node: X })),
        ),
        h("input", { id: "site-search", type: "search", placeholder: "Search six pages…", autocomplete: "off", "data-search-input": true }),
        h("div", { class: "search-results", "data-search-results": true, "aria-live": "polite" }, h("p", null, "Type to search six pages.")),
      ),
      h("script", { type: "application/json", "data-search-pages": true, dangerouslySetInnerHTML: { __html: JSON.stringify(pages).replace(/</g, "\\u003c") } }),
    ),
  );
}

