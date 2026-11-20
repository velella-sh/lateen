import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Head, LayoutProps, LinkTag, MetaTag, Page, Site, SiteConfig } from "@velella/mizzen/contracts";
import announcement from "../chrome/announcement/index.ts";
import codeCopy from "../chrome/code-copy/index.ts";
import footnotePopover from "../chrome/footnote-popover/index.ts";
import { alternateLinks, canonicalLink } from "../chrome/language-switcher/index.ts";
import networkFooter from "../chrome/network-footer/index.ts";
import projectSwitcher from "../chrome/project-switcher/index.ts";
import { footer as shellFooter } from "../chrome/shell/index.ts";
import { resolveNetworkOptions, optionOf } from "../src/options.ts";
import shortcuts from "../chrome/shortcuts/index.ts";
import sourceMode from "../chrome/source-mode/index.ts";
import skipLinks, { MAIN_ID, NAVIGATION_ID } from "../chrome/skip-links/index.ts";
import { THEME_KEY } from "../chrome/theme-toggle/key.ts";
import { brandCss, problemComment, resolveBrand } from "../src/brand.ts";

export { MAIN_ID, NAVIGATION_ID };

/** localStorage key that holds the visitor's choice: `light`, `dark`, or `system`. */
export { THEME_KEY };

/**
 * Sets `data-theme` on `<html>` before first paint. A stored `light` or `dark` wins; `system` follows
 * `prefers-color-scheme`; a first visit (nothing stored) is dark. Storage may throw (private mode), so it
 * falls back to dark. It also sets `data-js`, so styles can tell a page that will run its scripts from one that will not
 * and lay out the first paint the way the scripts leave it (the mobile drawer starts closed instead of open).
 */
export const THEME_SCRIPT =
  `(function(){var d=document.documentElement,t="dark";try{var s=localStorage.getItem("${THEME_KEY}");` +
  `if(s==="light"||s==="dark")t=s;else if(s==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}` +
  `catch(e){}d.setAttribute("data-theme",t);d.setAttribute("data-js","")})()`;

/** Content for the slots the layout places around the page. Each is optional and renders nothing when empty. */
export interface BaseSlots {
  /** Site header: logo, tabs, search, theme switch. The header chrome renders the banner landmark. */
  readonly header?: ComponentChildren;
  /** Sidebar navigation, beside the main column. Its own `<nav>` is the navigation landmark. */
  readonly sidebar?: ComponentChildren;
  /** The page itself; falls back to the page's rendered HTML. */
  readonly main?: ComponentChildren;
  /** Aside beside the main column, such as the table of contents, which brings its own navigation landmark. */
  readonly aside?: ComponentChildren;
  /** Site footer; the theme's own footer (from the `footer` theme options) when none is given. */
  readonly footer?: ComponentChildren;
}

export type BaseProps = LayoutProps & BaseSlots;

function metaTag(tag: MetaTag) {
  return h("meta", { [tag.property ? "property" : "name"]: tag.name, content: tag.content });
}

function linkTag(tag: LinkTag) {
  return h("link", { ...tag.attrs, rel: tag.rel, href: tag.href });
}

/** The icon links from the theme option `favicon` (`svg`, `ico`, `apple`), each a path from the site root; none when unset. */
function iconLinks(config: SiteConfig): LinkTag[] {
  const value = optionOf(config.theme.options, "favicon");
  if (typeof value !== "object" || value === null) return [];
  const icons = value as Record<string, unknown>;
  const href = (path: unknown) => (typeof path === "string" ? (path.startsWith("/") ? `${config.base}${path}` : path) : undefined);
  const links: LinkTag[] = [];
  const ico = href(icons.ico);
  const svg = href(icons.svg);
  const apple = href(icons.apple);
  if (ico) links.push({ rel: "icon", href: ico, attrs: { sizes: "48x48" } });
  if (svg) links.push({ rel: "icon", href: svg, attrs: { type: "image/svg+xml", sizes: "any" } });
  if (apple) links.push({ rel: "apple-touch-icon", href: apple });
  return links;
}

/** JSON-LD must not close its own script element, so `<` is escaped. */
function jsonLd(data: Readonly<Record<string, unknown>>) {
  return h("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  });
}

/**
 * The brand overrides as one `<style>` after the head's links, or nothing when the site sets no brand.
 * The selector is `:root:root`, so it wins over the single `:root` in `styles/tokens.css` whichever
 * stylesheet the engine writes later. A value that was ignored is a CSS comment naming the option.
 * A replaced default family asks the engine to leave its preload out; the shipped face stays in the
 * stylesheet as a fallback, so a site with custom fonts neither downloads nor preloads it first.
 */
function brandStyle(config: SiteConfig, hints: LayoutProps["hints"]) {
  const { brand, problems } = resolveBrand(config.theme.options);
  if (brand?.sans !== undefined) hints?.skipFontPreload("Manrope");
  if (brand?.mono !== undefined) hints?.skipFontPreload("JetBrains Mono");
  const comments = problems.map(problemComment).join("\n");
  const css = [brand === undefined ? "" : brandCss(brand, { base: config.base }), comments].filter((part) => part !== "").join("\n");
  return css === "" ? null : h("style", { "data-brand": true, dangerouslySetInnerHTML: { __html: css } });
}

/**
 * Everything inside `<head>`, in a fixed order, with the theme script first so nothing paints before it.
 * The page's canonical and translation alternates come from the language-switcher model, which honors
 * a front-matter `canonical_url` (a versioned copy names its default release). The layout only adds
 * one when the head has none, and never writes a second one.
 */
function headNodes(head: Head, site: Site, page: Page, hints: LayoutProps["hints"]) {
  const links = [...head.links];
  if (!links.some((tag) => tag.rel === "canonical")) {
    const canonical = canonicalLink(site, page);
    if (canonical !== undefined) links.push(canonical);
  }
  const alternates = new Set(
    links.flatMap((tag) => (tag.rel === "alternate" && tag.attrs?.hreflang !== undefined ? [tag.attrs.hreflang.toLowerCase()] : [])),
  );
  for (const alternate of alternateLinks(site, page)) {
    const hreflang = alternate.attrs?.hreflang;
    if (hreflang !== undefined && alternates.has(hreflang.toLowerCase())) continue;
    links.push(alternate);
    if (hreflang !== undefined) alternates.add(hreflang.toLowerCase());
  }
  return [
    h("meta", { charset: "utf-8" }),
    h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
    h("script", { dangerouslySetInnerHTML: { __html: THEME_SCRIPT } }),
    h("title", null, head.title),
    ...head.meta.map(metaTag),
    ...(page.frontMatter.noindex === true && !head.meta.some((tag) => tag.name === "robots")
      ? [metaTag({ name: "robots", content: "noindex" })]
      : []),
    ...links.map(linkTag),
    ...iconLinks(site.config).map(linkTag),
    ...head.jsonLd.map(jsonLd),
    brandStyle(site.config, hints),
  ];
}

/**
 * The document shell every page uses: `<html lang dir>`, the head, the skip links, and the main and footer
 * landmarks, with slots for header, sidebar, main, aside, and footer. The header, sidebar, and aside slots
 * render as given: the header chrome carries the banner landmark and the sidebar and table of contents
 * carry their own named navigation landmarks, so wrapping them here would repeat a landmark and its name.
 * It places the footnote popover's mount point once per page. Islands load at the end of the body. The
 * navigation skip link is left out when no sidebar slot is given, since its target is not there.
 */
export default function base(props: BaseProps) {
  const { page, head, islands, header, sidebar, main, aside, footer } = props;
  const network = resolveNetworkOptions(props.site.config.theme.options);
  const networkChrome =
    props.site.network === undefined
      ? null
      : h(
          Fragment,
          null,
          network.switcher && network.position === "footer"
            ? (projectSwitcher(props) as ComponentChildren)
            : null,
          network.footer ? (networkFooter(props) as ComponentChildren) : null,
        );
  const footerNode = footer ?? (shellFooter(props) as ComponentChildren);
  const footerContent =
    footerNode == null && networkChrome == null ? null : h(Fragment, null, footerNode, networkChrome);
  return h(
    "html",
    { lang: page.lang, dir: page.dir, "data-theme": "dark" },
    h("head", null, ...headNodes(head, props.site, page, props.hints)),
    h(
      "body",
      null,
      skipLinks({ ...props, navigation: sidebar != null }),
      announcement(props) as ComponentChildren,
      codeCopy(props) as ComponentChildren,
      header,
      h(
        "div",
        { class: sidebar == null ? "layout" : "layout doc-layout" },
        sidebar == null ? null : h("div", { class: "sidebar", id: NAVIGATION_ID }, sidebar),
        h(
          "main",
          { id: MAIN_ID, tabIndex: -1 },
          main ?? h("div", { dangerouslySetInnerHTML: { __html: page.html } }),
        ),
        aside == null ? null : h("div", { class: "aside" }, aside),
      ),
      footnotePopover(props) as ComponentChildren,
      footerContent == null ? null : h("footer", null, footerContent),
      shortcuts(props) as ComponentChildren,
      sourceMode(props) as ComponentChildren,
      ...islands.map((island) => h("script", { type: "module", src: island.src })),
    ),
  );
}
