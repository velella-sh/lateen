import { Fragment, h } from "preact";
import { isRecord } from "../src/guards.ts";
import type { Layout, LayoutProps, LinkTag, MetaTag, Page, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../i18n/index.ts";
import { factsPanel, recordHeader } from "../src/record-parts.ts";
import { pageHtml } from "../src/article-html.ts";
import { deferredScript } from "./shared/head.ts";
import { previewBanner } from "./shared/preview.ts";

/** Class on the page body wrapper; `embedded.css` sizes it. */
export const EMBEDDED_CLASS = "embedded";

/** Class on the page content, which is clipped at the declared height. */
export const CONTENT_CLASS = "embedded-content";

/** Class on the attribution line with the link to the full page. */
export const ATTRIBUTION_CLASS = "embedded-attribution";

/** The height in pixels used when front matter declares none. */
export const DEFAULT_HEIGHT = 360;

/** The smallest and largest height a page may declare, in pixels. */
export const MIN_HEIGHT = 120;
export const MAX_HEIGHT = 2000;

/** Colour schemes an embedded view can publish. */
export const SCHEMES = ["auto", "light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

/** The `embedded` front matter of a page, normalised. */
export interface Embedded {
  /** Address of the full page, as written; `undefined` when front matter gives none. */
  readonly of: string | undefined;
  readonly scheme: Scheme;
  /** Height in pixels. */
  readonly height: number;
  /** True when the canvas is transparent. */
  readonly transparent: boolean;
}

/** The `embedded` front matter of a page; a missing or malformed value yields the defaults. */
export function embeddedOf(page: Pick<Page, "frontMatter">): Embedded {
  const raw = page.frontMatter.embedded;
  const value = isRecord(raw) ? raw : {};
  const canonical = typeof page.frontMatter.canonical_url === "string" ? page.frontMatter.canonical_url.trim() : "";
  const of =
    typeof value.of === "string" && value.of.trim() !== "" ? value.of.trim() : canonical !== "" ? canonical : undefined;
  const scheme = SCHEMES.find((name) => name === value.scheme) ?? "auto";
  const number = typeof value.height === "number" ? value.height : typeof value.height === "string" ? Number(value.height) : NaN;
  const height = Number.isFinite(number) ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(number))) : DEFAULT_HEIGHT;
  return { of, scheme, height, transparent: value.transparent === true };
}

/** True when the page is an embedded view. */
export function isEmbedded(page: Pick<Page, "frontMatter">): boolean {
  return isRecord(page.frontMatter.embedded);
}

/**
 * A site address made absolute: an `http`/`https` address is kept and a root-relative path gets the site's
 * `url` in front. Anything else, or a path on a site without `url`, has no absolute form.
 */
export function absoluteUrl(config: Pick<SiteConfig, "url">, value: string): string | undefined {
  if (/^https?:\/\//i.test(value)) return value;
  const origin = (config.url ?? "").replace(/\/+$/, "");
  if (origin === "" || !/^\/(?!\/)/.test(value)) return undefined;
  return `${origin}${value}`;
}

/** The address the attribution links to: the absolute form when there is one, else a root-relative path, else nothing. */
function fullHref(config: SiteConfig, of: string | undefined): string | undefined {
  if (of === undefined) return undefined;
  const absolute = absoluteUrl(config, of);
  if (absolute !== undefined) return absolute;
  return /^\/(?!\/)/.test(of) ? of : undefined;
}

function metaTag(tag: MetaTag) {
  return h("meta", { [tag.property ? "property" : "name"]: tag.name, content: tag.content });
}

function linkTag(tag: LinkTag) {
  return h("link", { ...tag.attrs, rel: tag.rel, href: tag.href });
}

/**
 * The embedded view: the page body alone, with no header, sidebar, footer, search, islands or theme script.
 * A record view adds the record's title, status and
 * key facts from the same formatters the record page uses. A one-line attribution links to the full page in the
 * top window. The view is `noindex` and its canonical link is the full page named in `embedded.of`, or the
 * canonical address the engine gave a record view. The colour scheme, height and transparent canvas come
 * from `embedded` front matter and reach the stylesheet as data attributes and one custom property, so no
 * script or query parameter is needed.
 */
const embedded: Layout = (props: LayoutProps) => {
  const { site, page, head } = props;
  const settings = embeddedOf(page);
  const href = fullHref(site.config, settings.of);
  const canonical = settings.of === undefined ? undefined : (absoluteUrl(site.config, settings.of) ?? href);
  const links = head.links.filter((tag) => tag.rel !== "alternate" && (site.preview !== undefined || tag.rel !== "canonical"));
  if (site.preview === undefined && canonical !== undefined) links.push({ rel: "canonical", href: canonical });
  const meta = head.meta.filter((tag) => tag.name.toLowerCase() !== "robots");
  const lang = page.lang;
  const label = t(lang, "embedded_open_full");
  const record = props.record === undefined ? null : h(Fragment, null, recordHeader(props), factsPanel(props));

  return h(
    "html",
    {
      lang,
      dir: page.dir,
      "data-scheme": settings.scheme,
      "data-transparent": settings.transparent ? "true" : "false",
    },
    h(
      "head",
      null,
      h("meta", { charset: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      h("meta", { name: "robots", content: "noindex" }),
      h("title", null, head.title),
      ...meta.map(metaTag),
      ...links.map(linkTag),
      ...(head.scripts ?? []).map(deferredScript),
    ),
    h(
      "body",
      { class: "embedded-body" },
      previewBanner(props),
      h(
        "div",
        { class: EMBEDDED_CLASS, "data-embedded-height": String(settings.height), style: `--embedded-height:${settings.height}px` },
        record === null
          ? h("main", { class: CONTENT_CLASS, dangerouslySetInnerHTML: { __html: pageHtml(page.html, page.lang) } })
          : h(
              "main",
              { class: CONTENT_CLASS },
              record,
              h("div", { dangerouslySetInnerHTML: { __html: pageHtml(page.html, page.lang) } }),
            ),
        h(
          "p",
          { class: ATTRIBUTION_CLASS },
          h("span", null, t(lang, "embedded_from", { site: site.config.title })),
          " ",
          href === undefined
            ? null
            : h("a", { href, target: "_top", rel: "noopener" }, label),
        ),
      ),
    ),
  );
};

export default embedded;
