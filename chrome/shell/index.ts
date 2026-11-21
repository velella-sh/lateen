import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Chrome, Site, SiteConfig } from "@velella/mizzen/contracts";
import { CodeXml, Search } from "lucide";
import type { IconNode } from "lucide";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { t } from "../../i18n/index.ts";
import { textOf as footerText } from "../../src/guards.ts";
import { icon } from "../../src/icon.ts";
import { safeHref, withBase } from "../../src/url.ts";
import { optionOf, resolveNetworkOptions } from "../../src/options.ts";
import languageSwitcher from "../language-switcher/index.ts";
import projectSwitcher from "../project-switcher/index.ts";
import search from "../search/index.ts";
import themeToggle from "../theme-toggle/index.ts";
import versionSwitcher from "../version-switcher/index.ts";

const PACKAGE_VERSION = `v${(JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8")) as { version: string }).version}`;

const Github: IconNode = [
  ["path", { d: "M9 19c-4 1.5-4-2.5-6-3m14 6v-3.8a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5 5 0 0 0 19.9 1S18.7.7 16 2.5a13 13 0 0 0-7 0C6.3.7 5.1 1 5.1 1A5 5 0 0 0 5 4.8 5.4 5.4 0 0 0 3.5 8.6c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 0 0-.9 2.6V22" }],
];

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

function repositoryLink(config: SiteConfig) {
  const url = config.repository?.url;
  if (!url) return null;
  const github = onGitHub(url);
  return h(
    "a",
    {
      class: "iconbtn",
      href: url,
      rel: "noopener",
      "aria-label": github ? "GitHub repository" : "Repository",
    },
    icon({ node: github ? Github : CodeXml }),
  );
}

/** The site's top-level sections in navigation order; a group counts as its first link under the group's title. */
export function sectionLinks(site: Site): readonly { readonly title: string; readonly url: string }[] {
  return (site.nav.main ?? []).flatMap((item) => {
    if (typeof item.title !== "string") return [];
    if ("url" in item && typeof item.url === "string") return [{ title: item.title, url: item.url }];
    if (!("children" in item) || !Array.isArray(item.children)) return [];
    const first = item.children.find((child) => "url" in child && typeof child.url === "string");
    return first && "url" in first && typeof first.url === "string" ? [{ title: item.title, url: first.url }] : [];
  });
}

/** Whether a section link covers the page; the home link matches only the home page. */
export function isCurrentSection(url: string, pageUrl: string, base: string): boolean {
  return url === `${base}/` || url === `${base}` ? pageUrl === url || pageUrl === `${base}/` : pageUrl.startsWith(url);
}

/** Sailcloth site chrome: glass header + Pagefind search, with version/language/project switchers. */
const shell: Chrome = (props) => {
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
  const currentSection = sections.find((item) => isCurrentSection(item.url, page.url, base));

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
        h("span", { class: "brand-tag" }, PACKAGE_VERSION),
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
            `${t(page.lang, "search_placeholder")} `,
            h("kbd", null, "⌘K"),
          ),
          languageSwitcher(props) as ComponentChildren,
          themeToggle(props) as ComponentChildren,
          repositoryLink(config),
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
      h("a", { class: "footer-name", href: `${site.config.base}/` }, site.config.title || "Lateen"),
      footerLinks.length === 0
        ? null
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
