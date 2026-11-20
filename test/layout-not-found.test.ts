import assert from "node:assert/strict";
import { test } from "node:test";
import { Fragment, h } from "preact";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import notFound, { homeHref } from "../layouts/not-found.ts";
import { stringsOf } from "../i18n/index.ts";
import type { LanguageConfig } from "@velella/mizzen/contracts";

const pos: SourcePos = { file: "404.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

/** A configured language with the fields the tests do not vary filled in. */
function language(code: string, prefix: string, name = code): LanguageConfig {
  return { code, name, prefix };
}

function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "",
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
    ...overrides,
  };
}

function layoutProps(
  config: Partial<SiteConfig> = {},
  pageOverrides: Partial<Pick<Page, "lang" | "dir">> = {},
): LayoutProps {
  const page: Page = {
    url: "/404.html",
    source: pos,
    frontMatter: {},
    title: "Not found",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...pageOverrides,
  };
  const site: Site = { config: configWith(config), pages: [page], nav: { main: [] }, data: {}, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Not found · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}

type VNode = { type: unknown; props: { children?: unknown; dangerouslySetInnerHTML?: { __html: string }; [key: string]: unknown } };

function isVNode(node: unknown): node is VNode {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

const VOID = new Set(["meta", "link", "input"]);

/** Minimal Preact vnode → HTML string for assertions (no render-to-string dependency). */
function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isVNode(node)) return "";
  if (node.type === Fragment) return html(node.props.children);
  if (typeof node.type === "function") return html((node.type as (p: object) => unknown)(node.props));
  const tag = node.type as string;
  const { children, dangerouslySetInnerHTML, ...rest } = node.props;
  const attrs = Object.entries(rest)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value)}"`))
    .join("");
  if (VOID.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children)}</${tag}>`;
}

const out = (props: LayoutProps) => html(notFound(props));

test("renders a 404 heading and message inside main", () => {
  const page = out(layoutProps());
  assert.match(page, /<main id="main" tabindex="-1"><div class="not-found lonely"><p class="not-found-code code-mark" aria-hidden="true">404<\/p><h1>Page not found<\/h1><p class="lead">/i);
});

test("404 offers base-aware home and search actions without JavaScript", () => {
  const page = out(layoutProps({ base: "/docs" }));
  assert.match(page, /<div class="not-found-actions actions">/);
  assert.match(page, /<a class="btn home-btn-primary" href="\/docs\/">Home<\/a>/);
  assert.match(page, /<a class="btn home-btn-quiet" href="\/docs\/search\/">Search the docs<\/a>/);
  assert.ok(!page.includes("type=\"module\""));
  assert.ok(!page.includes("not-found-search"));
  assert.ok(!page.includes("not-found-sections"));
});

test("404 content sits in the base shell, so the document keeps lang, dir, and the skip link", () => {
  const page = out(layoutProps());
  assert.match(page, /^<html lang="en" dir="ltr"/);
  assert.match(page, /<body><a class="skip-link" href="#main">Skip to content<\/a>/);
});

/** The site the localized tests share: an English default with a configured Persian home under `/fa`. */
const bilingual = (base = ""): Partial<SiteConfig> => ({
  base,
  languages: [language("en", ""), language("fa", "/fa", "فارسی")],
});

/** A catalog text the test names directly; fails loudly when the key is gone. */
function msg(table: Readonly<Record<string, string | undefined>>, key: string): string {
  const text = table[key];
  assert.ok(typeof text === "string" && text !== "", `catalog key ${key} is missing`);
  return text;
}

test("every English recovery string comes from the catalog the page language reads", () => {
  const en = stringsOf("en");
  const page = out(layoutProps(bilingual()));
  assert.ok(page.includes(`<h1>${en.not_found_title}</h1>`));
  assert.ok(page.includes(msg(en, "not_found_text")));
  assert.ok(page.includes(`<a class="btn home-btn-primary" href="/">${en.home}</a>`));
  assert.ok(page.includes(`<a class="btn home-btn-quiet" href="/search/">${en.search_placeholder}</a>`));
});

test("a Persian page localizes every recovery string, in the page language, not the site language", () => {
  const fa = stringsOf("fa");
  const en = stringsOf("en");
  const page = out(layoutProps(bilingual(), { lang: "fa", dir: "rtl" }));
  assert.match(page, /^<html lang="fa" dir="rtl"/);
  assert.ok(page.includes(`<h1>${fa.not_found_title}</h1>`));
  assert.ok(page.includes(msg(fa, "not_found_text")));
  assert.ok(page.includes(`<a class="btn home-btn-primary" href="/fa/">${fa.home}</a>`));
  assert.ok(page.includes(`<a class="btn home-btn-quiet" href="/search/">${fa.search_placeholder}</a>`));
  assert.ok(page.includes(`>${fa.skip_to_content}</a>`), "the shell skip link follows the page language too");
  assert.ok(!page.includes(msg(en, "not_found_title")), "no English recovery text remains");
});

test("an Arabic page localizes both recovery actions and preserves the site base", () => {
  const ar = stringsOf("ar");
  const page = out(
    layoutProps({ base: "/docs", languages: [language("en", ""), language("ar", "/ar", "العربية")] }, {
      lang: "ar",
      dir: "rtl",
    }),
  );
  assert.ok(page.includes(`<h1>${ar.not_found_title}</h1>`));
  assert.ok(page.includes(`<a class="btn home-btn-primary" href="/docs/ar/">${ar.home}</a>`));
  assert.ok(page.includes(`<a class="btn home-btn-quiet" href="/docs/search/">${ar.search_placeholder}</a>`));
});

test("a regional page language reads its primary subtag's catalog and configured prefix", () => {
  const fa = stringsOf("fa");
  const page = out(layoutProps(bilingual("/docs"), { lang: "fa-IR", dir: "rtl" }));
  assert.ok(page.includes(`<h1>${fa.not_found_title}</h1>`));
  assert.ok(page.includes(`<a class="btn home-btn-primary" href="/docs/fa/">${fa.home}</a>`));
  assert.ok(page.includes(`<a class="btn home-btn-quiet" href="/docs/search/">${fa.search_placeholder}</a>`));
  assert.ok(!page.includes("/docs/fa-IR/"), "an unconfigured regional prefix is never guessed");
});

test("homeHref resolves the configured current language's home with base exactly once", () => {
  const config = configWith(bilingual("/docs"));
  assert.equal(homeHref(config, "fa"), "/docs/fa/");
  assert.equal(homeHref(config, "en"), "/docs/");
  assert.equal(homeHref(config, "FA"), "/docs/fa/");
  assert.equal(homeHref(config, "fa_IR"), "/docs/fa/");
  const root = configWith(bilingual());
  assert.equal(homeHref(root, "fa"), "/fa/");
  assert.equal(homeHref(root, "en"), "/");
});

test("homeHref never guesses a prefix no language configures", () => {
  assert.equal(homeHref(configWith(bilingual("/docs")), "de"), "/docs/");
  assert.equal(homeHref(configWith({ base: "", languages: [] }), "de"), "/");
});
