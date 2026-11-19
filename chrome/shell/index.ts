import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Chrome, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
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
          light ? h("img", { class: "brand-logo brand-logo-light", src: light, alt: "", width: 28, height: 28 }) : null,
          dark ? h("img", { class: "brand-logo brand-logo-dark", src: dark, alt: "", width: 28, height: 28 }) : null,
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

const GITHUB_MARK =
  "M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z";

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
    github
      ? h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }, h("path", { d: GITHUB_MARK }))
      : h(
          "svg",
          { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
          h("path", { d: "M8 6l-5 6 5 6M16 6l5 6-5 6" }),
        ),
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

  const fromNav = (site.nav.main ?? []).flatMap((item) =>
    "url" in item && typeof item.url === "string" && typeof item.title === "string"
      ? [{ title: item.title, url: item.url }]
      : [],
  );
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
              "aria-label": t(page.lang, "search"),
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
