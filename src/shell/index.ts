import { h } from "preact";
import type { ChromeProps } from "@velella/mizzen/contracts";
import { CodeXml, Moon, Search, Sun } from "lucide";
import { icon } from "../icon.ts";

export default function shell({ site, page }: ChromeProps) {
  const base = site.config.base;
  const pages = site.pages.map((entry) => ({
    title: entry.title,
    description: String(entry.frontMatter.description ?? ""),
    url: entry.url,
  }));
  const fromNav = (site.nav.main ?? []).flatMap((item) =>
    "url" in item && typeof item.url === "string" && typeof item.title === "string"
      ? [{ title: item.title, url: item.url }]
      : [],
  );
  const sections = fromNav.length > 0
    ? fromNav
    : [{ title: "Start", url: `${base}/` }];
  const currentSection = sections.find((item) =>
    item.url === `${base}/` || item.url === `${base}`
      ? page.url === item.url || page.url === `${base}/`
      : page.url.startsWith(item.url),
  );

  return [
    h("div", { class: "progress", "aria-hidden": "true", "data-progress": true }),
    h("header", { class: "site-header", "data-site-header": true },
      h("div", { class: "rail header-inner" },
        h("a", { class: "brand", href: `${base}/` },
          h("span", { class: "brand-mark", "aria-hidden": "true" }),
          "Lateen",
        ),
        h("span", { class: "brand-tag" }, "v0.2.3"),
        h("nav", { class: "top-nav sections", "aria-label": "Sections" }, sections.map((item) =>
          h("a", {
            href: item.url,
            ...(currentSection?.url === item.url ? { "aria-current": "page" } : {}),
          }, item.title),
        )),
        h("div", { class: "header-actions tools" },
          h("button", {
            type: "button",
            class: "search-trigger",
            "data-search-open": true,
          }, "Search the docs ", h("kbd", null, "⌘K")),
          h("button", {
            type: "button",
            class: "iconbtn theme-toggle",
            "aria-label": "Switch theme",
            "aria-pressed": "false",
            "data-shell-theme-toggle": true,
          },
            h("span", { class: "theme-sun" }, h(icon, { node: Sun })),
            h("span", { class: "theme-moon" }, h(icon, { node: Moon })),
          ),
          h("a", {
            class: "iconbtn",
            href: "https://github.com/velella-sh/lateen",
            "aria-label": "GitHub",
          }, h(icon, { node: CodeXml })),
        ),
      ),
      h("dialog", { class: "search-dialog", "data-search-dialog": true, "aria-label": "Search the docs" },
        h("form", { method: "dialog", class: "search-panel", role: "search" },
          h("label", { class: "search-field" },
            h("span", { class: "sr-only" }, "Search the docs"),
            h("input", {
              type: "search",
              name: "q",
              placeholder: "Search the docs…",
              autocomplete: "off",
              spellcheck: false,
              "data-search-input": true,
            }),
            h("kbd", null, "esc"),
          ),
          h("div", { class: "search-results", "data-search-results": true }),
          h("div", { class: "search-foot", "aria-hidden": "true" },
            h("span", null, h("kbd", null, "↑"), " ", h("kbd", null, "↓"), " move"),
            h("span", null, h("kbd", null, "↵"), " open"),
            h("span", null, h("kbd", null, "esc"), " close"),
          ),
          h("script", {
            type: "application/json",
            "data-search-pages": true,
            dangerouslySetInnerHTML: { __html: JSON.stringify(pages).replace(/</g, "\\u003c") },
          }),
        ),
      ),
    ),
  ];
}

export function footer({ site }: Pick<ChromeProps, "site">) {
  const base = site.config.base;
  const footerLinks = (site.nav.main ?? []).flatMap((item) =>
    "url" in item && typeof item.url === "string" && typeof item.title === "string"
      ? [{ title: item.title, url: item.url }]
      : [],
  );
  // Production `layouts/base` already wraps the footer slot in `<footer>`.
  return h("div", { class: "site-footer" },
    h("div", { class: "rail footer-inner" },
      h("a", { class: "brand", href: `${base}/` },
        h("span", { class: "brand-mark", "aria-hidden": "true" }),
        "Lateen",
      ),
      footerLinks.length === 0
        ? null
        : h("nav", { class: "sections", "aria-label": "Footer" }, footerLinks.map((item) =>
          h("a", { href: item.url }, item.title),
        )),
      h("div", { class: "tools" },
        h("span", { class: "legal" }, "© Velella"),
        h("span", { class: "legal" }, "MIT"),
        h("a", {
          class: "iconbtn",
          href: "https://github.com/velella-sh/lateen",
          "aria-label": "GitHub",
        }, h(icon, { node: CodeXml })),
      ),
    ),
  );
}
