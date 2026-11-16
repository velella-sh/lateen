import { Fragment } from "preact";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";

const pos: SourcePos = { file: "p.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

export function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example", base: "", lang: "en", dir: "ltr", languages: [], source: ".", include: [], exclude: [],
    navigation: "_data/navigation.yml", defaults: [], theme: { options: {} }, search: { text: 300 },
    redirects: {}, outputs: {}, collections: {}, ...overrides,
  };
}

export function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/embed/guide/", source: pos, frontMatter: {}, title: "Guide", lang: "en", dir: "ltr", headings: [],
    html: "<p>Body</p>", markdown: "Body", kind: "doc", ...overrides,
  };
}

export function siteWith(pages: Page[], overrides: Partial<SiteConfig> = {}): Site {
  return { config: config(overrides), pages, nav: { main: [] }, data: {}, collections: {} } as unknown as Site;
}

export function layoutProps(page: Page, site: Site, links: { rel: string; href: string }[] = []): LayoutProps {
  return {
    site, page, trail: [], pager: {},
    head: { title: `${page.title} · Example`, meta: [{ name: "robots", content: "index" }], links, jsonLd: [] },
    islands: [{ name: "x", src: "/x.js" }],
  } as unknown as LayoutProps;
}

type VNode = { type: unknown; props: { children?: unknown; dangerouslySetInnerHTML?: { __html: string }; [k: string]: unknown } };
const VOID = new Set(["meta", "link", "input"]);

/** Minimal vnode to HTML string for assertions. */
export function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(html).join("");
  if (typeof node !== "object" || !("type" in node)) return "";
  const v = node as VNode;
  if (v.type === Fragment) return html(v.props.children);
  if (typeof v.type === "function") return html((v.type as (p: object) => unknown)(v.props));
  const tag = v.type as string;
  const { children, dangerouslySetInnerHTML, ...rest } = v.props;
  const attrs = Object.entries(rest)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value)}"`))
    .join("");
  if (VOID.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children)}</${tag}>`;
}
