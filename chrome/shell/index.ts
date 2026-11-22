import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Chrome, Site, SiteConfig } from "@velella/mizzen/contracts";
import { Search } from "lucide";
import { t } from "../../i18n/index.ts";
import { textOf as footerText } from "../../src/guards.ts";
import { icon } from "../../src/icon.ts";
import { safeHref, withBase } from "../../src/url.ts";
import { optionOf, resolveNetworkOptions } from "../../src/options.ts";
import languageSwitcher from "../language-switcher/index.ts";
import projectSwitcher from "../project-switcher/index.ts";
import search from "../search/index.ts";
import type { SourceModeVisibility } from "../source-mode/state.ts";
import themeToggle from "../theme-toggle/index.ts";
import versionSwitcher from "../version-switcher/index.ts";

type Logo = { readonly light?: string; readonly dark?: string };

function logoOf(config: SiteConfig): Logo | undefined {
  const value = optionOf(config.theme.options, "logo");
  return typeof value === "object" && value !== null ? (value as Logo) : undefined;
}

function brand(config: SiteConfig) {
  const logo = logoOf(config);
  const light = logo?.light ? withBase(config.base, logo.light) : undefined;
  const dark = logo?.dark ? withBase(config.base, logo.dark) : undefined;
  return h(
    "a",
    { class: "brand", href: `${config.base}/` },
    light || dark
      ? h(
          "span",
          { class: "brand-logo-frame", "aria-hidden": "true" },
          light ? h("img", { class: `brand-logo${dark ? " brand-logo-light" : ""}`, src: light, alt: "", width: 28, height: 28 }) : null,
          dark ? h("img", { class: `brand-logo${light ? " brand-logo-dark" : ""}`, src: dark, alt: "", width: 28, height: 28 }) : null,
        )
      : h("span", { class: "brand-mark", "aria-hidden": "true" }),
    config.title || "Lateen",
  );
}

function onGitHub(url: string): boolean {
  try {
    return new URL(url).hostname === "github.com";
  } catch {
    return false;
  }
}

/** The site's top-level sections in navigation order; a group counts as its first link under the group's title. */
export function sectionLinks(
  site: Site,
): readonly { readonly title: string; readonly url: string; readonly pages?: readonly string[] }[] {
  return (site.nav.main ?? []).flatMap((item) => {
    if (typeof item.title !== "string") return [];
    if ("url" in item && typeof item.url === "string") return [{ title: item.title, url: item.url }];
    if (!("children" in item) || !Array.isArray(item.children)) return [];
    const first = item.children.find((child) => "url" in child && typeof child.url === "string");
    return first && "url" in first && typeof first.url === "string"
      ? [{ title: item.title, url: first.url, pages: urlsUnder(item.children) }]
      : [];
  });
}

/** Every page URL a nav group lists, at any depth, so a section stays current on all of its pages. */
function urlsUnder(children: readonly unknown[]): string[] {
  return children.flatMap((child) => {
    if (typeof child !== "object" || child === null) return [];
    const own = "url" in child && typeof child.url === "string" ? [child.url] : [];
    const nested = "children" in child && Array.isArray(child.children) ? urlsUnder(child.children) : [];
    return [...own, ...nested];
  });
}

/** Whether a section link covers the page; the home link matches only the home page. */
export function isCurrentSection(url: string, pageUrl: string, base: string): boolean {
  return url === `${base}/` || url === `${base}` ? pageUrl === url || pageUrl === `${base}/` : pageUrl.startsWith(url);
}

/** Sailcloth site chrome: glass header + Pagefind search, with version/language/project switchers. */
const shell = (props: Parameters<Chrome>[0] & SourceModeVisibility) => {
  const { site, page } = props;
  const { config } = site;
  const base = config.base;
  const network = resolveNetworkOptions(config.theme.options);
  const switcher =
    site.network !== undefined && network.switcher && network.position === "header"
      ? (projectSwitcher(props) as ComponentChildren)
      : null;

  const fromNav = sectionLinks(site);
  const sections = fromNav.length > 0 ? fromNav : [{ title: "Start", url: `${base}/` }];
  // A group that lists the page wins over a URL prefix, so "Start" is current on its own pages and
  // not only on its first one (often the home page).
  const currentSection =
    sections.find((item) => "pages" in item && item.pages?.includes(page.url) === true) ??
    sections.find((item) => isCurrentSection(item.url, page.url, base));

  const bar = h(
    Fragment,
    null,
    h("div", { class: "progress", "aria-hidden": "true", "data-progress": true }),
    h(
      "header",
      { class: "site-header", "data-site-header": true },
      h(
        "div",
        { class: "rail header-inner" },
        brand(config),
        h(
          "nav",
          { class: "top-nav sections", "aria-label": "Sections" },
          sections.map((item) =>
            h(
              "a",
              {
                href: item.url,
                ...(currentSection?.url === item.url ? { "aria-current": "page" } : {}),
              },
              item.title,
            ),
          ),
        ),
        switcher,
        h(
          "div",
          { class: "header-actions tools" },
          versionSwitcher(props) as ComponentChildren,
          h(
            "button",
            {
              type: "button",
              class: "search-trigger",
              // Visible label is the accessible name; an aria-label that only said "Search"
              // failed axe label-content-name-mismatch against "Search the docs ⌘K".
              hidden: true,
              "data-search-open": true,
            },
            icon({ node: Search }),
            h("span", null, t(page.lang, "search")),
            // The island writes ⌘K or Ctrl+K for the platform; hidden from the name, which stays "Search".
            h("kbd", { class: "search-trigger-key", "aria-hidden": "true" }),
          ),
          languageSwitcher(props) as ComponentChildren,
          themeToggle(props) as ComponentChildren,
          h(
            "button",
            {
              type: "button",
              class: "iconbtn shell-menu",
              "aria-label": t(page.lang, "main_nav"),
              "aria-expanded": "false",
              hidden: true,
              "data-drawer-open": true,
            },
            h("span", { "aria-hidden": "true" }, "☰"),
          ),
        ),
      ),
    ),
  );

  return h(Fragment, null, bar, search(props) as ComponentChildren);
};

export default shell;

type FooterOptions = {
  readonly copyright?: unknown;
  readonly license?: unknown;
  readonly links?: unknown;
};

export function footer({ site }: Pick<Parameters<Chrome>[0], "site">) {
  const footerOptions = optionOf(site.config.theme.options, "footer");
  const options =
    typeof footerOptions === "object" && footerOptions !== null ? (footerOptions as FooterOptions) : undefined;
  const copyright = footerText(options?.copyright) ?? "© Velella";
  const license = footerText(options?.license) ?? "MIT";
  const footerLinks = Array.isArray(options?.links)
    ? options.links.flatMap((value: unknown) => {
        if (typeof value !== "object" || value === null) return [];
        const item = value as { title?: unknown; url?: unknown };
        const title = footerText(item.title);
        const url = safeHref(item.url, ["http:", "https:", "mailto:"]);
        if (title === undefined || url === undefined) return [];
        return [{ title, url: withBase(site.config.base, url) }];
      })
    : (site.nav.main ?? []).flatMap((item) =>
        "url" in item && typeof item.url === "string" && typeof item.title === "string"
          ? [{ title: item.title, url: item.url }]
          : [],
      );
  const repositoryUrl = site.config.repository?.url;
  if (repositoryUrl && !footerLinks.some(({ url }) => url.replace(/\/$/, "") === repositoryUrl.replace(/\/$/, ""))) {
    footerLinks.push({ title: onGitHub(repositoryUrl) ? "GitHub" : "Repository", url: repositoryUrl });
  }
  return h(
    "div",
    { class: "site-footer" },
    h(
      "div",
      { class: "rail footer-inner" },
      footerLinks.length === 0
        ? h("a", { class: "footer-name", href: `${site.config.base}/` }, site.config.title || "Lateen")
        : h(
            "nav",
            { class: "sections", "aria-label": "Footer" },
            footerLinks.map((item) => h("a", { href: item.url }, item.title)),
          ),
      h(
        "div",
        { class: "tools" },
        h("span", { class: "legal" }, copyright),
        h("span", { class: "legal" }, license),
      ),
    ),
  );
}
