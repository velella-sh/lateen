import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Chrome, SiteConfig } from "@velella/mizzen/contracts";
import { CodeXml, GitBranch } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { optionOf, resolveNetworkOptions } from "../../src/options.ts";
import languageSwitcher from "../language-switcher/index.ts";
import projectSwitcher from "../project-switcher/index.ts";
import search from "../search/index.ts";
import themeToggle from "../theme-toggle/index.ts";
import versionSwitcher from "../version-switcher/index.ts";

const PACKAGE_VERSION = `v${(JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8")) as { version: string }).version}`;

type Logo = { readonly light?: string; readonly dark?: string };

function logoOf(config: SiteConfig): Logo | undefined {
  const value = optionOf(config.theme.options, "logo");
  return typeof value === "object" && value !== null ? (value as Logo) : undefined;
}

function withBase(base: string, path: string): string {
  return path.startsWith("/") ? `${base}${path}` : path;
}

function brand(config: SiteConfig) {
  const logo = logoOf(config);
  const light = logo?.light ? withBase(config.base, logo.light) : undefined;
  const dark = logo?.dark ? withBase(config.base, logo.dark) : undefined;
  return h(
    "a",
    { class: "brand", href: `${config.base}/` },
    light || dark
      ? h(Fragment, null,
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
    icon({ node: github ? GitBranch : CodeXml }),
  );
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

  const fromNav = (site.nav.main ?? []).flatMap((item) => {
    if (typeof item.title !== "string") return [];
    if ("url" in item && typeof item.url === "string") return [{ title: item.title, url: item.url }];
    if (!("children" in item) || !Array.isArray(item.children)) return [];
    const first = item.children.find((child) => "url" in child && typeof child.url === "string");
    return first && "url" in first && typeof first.url === "string" ? [{ title: item.title, url: first.url }] : [];
  });
  const sections = fromNav.length > 0 ? fromNav : [{ title: "Start", url: `${base}/` }];
  const currentSection = sections.find((item) =>
    item.url === `${base}/` || item.url === `${base}`
      ? page.url === item.url || page.url === `${base}/`
      : page.url.startsWith(item.url),
  );

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
};

function footerText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function footer({ site }: Pick<Parameters<Chrome>[0], "site">) {
  const footerOptions = optionOf(site.config.theme.options, "footer");
  const options =
    typeof footerOptions === "object" && footerOptions !== null ? (footerOptions as FooterOptions) : undefined;
  const copyright = footerText(options?.copyright) ?? "© Velella";
  const license = footerText(options?.license) ?? "MIT";
  const footerLinks = (site.nav.main ?? []).flatMap((item) =>
    "url" in item && typeof item.url === "string" && typeof item.title === "string"
      ? [{ title: item.title, url: item.url }]
      : [],
  );
  return h(
    "div",
    { class: "site-footer" },
    h(
      "div",
      { class: "rail footer-inner" },
      brand(site.config),
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
        repositoryLink(site.config),
      ),
    ),
  );
}
