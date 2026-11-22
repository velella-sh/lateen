import assert from "node:assert/strict";
import { test } from "node:test";
import { Fragment, h } from "preact";
import type { Heading, LayoutProps, Page, RepositoryConfig, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import doc from "../../layouts/doc.ts";
import { readUiCss } from "../ui-css-helpers.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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

function heading(depth: 1 | 2 | 3, text: string): Heading {
  return { depth, text, id: text.toLowerCase(), pos };
}

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guide/install/",
    source: pos,
    frontMatter: {},
    title: "Install",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>Run the build.</p>",
    markdown: "Run the build.",
    kind: "doc",
    ...overrides,
  };
}

function layoutProps(
  page: Page,
  nav: Site["nav"]["main"] = [],
  trail: LayoutProps["trail"] = [],
  data: Site["data"] = {},
  repository?: RepositoryConfig,
): LayoutProps {
  const site: Site = {
    config: configWith(repository === undefined ? {} : { repository }),
    pages: [page],
    nav: { main: nav },
    data,
    collections: {},
  };
  return {
    site,
    page,
    trail,
    pager: { prev: { title: "Overview", url: "/guide/" }, next: { title: "Configure", url: "/guide/configure/" } },
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
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

const out = (page: Page, nav: Site["nav"]["main"] = [], trail: LayoutProps["trail"] = []) => html(doc(layoutProps(page, nav, trail)));

test("the article carries data-pagefind-body and sits in the main landmark", () => {
  const page = out(pageWith());
  assert.match(page, /<main id="main" tabIndex="-1">[\s\S]*?<article class="doc" data-pagefind-body>/);
});

test("the layout renders the h1 when the body has no top-level heading", () => {
  const page = out(pageWith());
  assert.match(page, /<article class="doc"[^>]*><div class="doc-context">[\s\S]*?<h1>Install<\/h1>/);
});

test("doc renders its authored description and groups quiet metadata", () => {
  const page = out(pageWith({ frontMatter: { description: "Install Lateen and serve a site." } }));
  assert.match(page, /<h1>Install<\/h1><p class="doc-description dek">Install Lateen and serve a site\.<\/p><div class="doc-meta">/);
  assert.equal((page.match(/<h1/g) ?? []).length, 1);
});

test("doc omits the description when none exists or it is blank", () => {
  assert.doesNotMatch(out(pageWith()), /doc-description/);
  assert.doesNotMatch(out(pageWith({ frontMatter: { description: "  \n" } })), /doc-description/);
});

test("the layout skips its h1 when a depth-1 heading exists, even with a front-matter title", () => {
  const page = out(
    pageWith({
      title: "From front matter",
      frontMatter: { title: "From front matter" },
      headings: [heading(1, "Install"), heading(2, "Pick a mode")],
    }),
  );
  assert.doesNotMatch(page, /<h1>/);
});

test("the body, page footer, and pager follow the title inside the article", () => {
  const page = out(pageWith());
  const article = /<article class="doc"[^>]*>(.*?)<\/article>/s.exec(page);
  assert.ok(article, "article present");
  assert.match(
    article[1] ?? "",
    /<div class="doc-body"><p>Run the build.<\/p><\/div><div class="doc-actions article-tools">[\s\S]*<nav class="pager" aria-label="Previous and next"><a class="pager-link pager-prev" href="\/guide\/" rel="prev">/,
  );
});

test("the Markdown disclosure groups copy and view before the pager", () => {
  const page = out(pageWith());
  const article = /<article class="doc"[^>]*>(.*?)<\/article>/s.exec(page);
  assert.ok(article, "article present");
  assert.match(
    article[1] ?? "",
    /<details name="article-tools"><summary>Markdown[\s\S]*<div class="copy-markdown" data-copy-markdown>[\s\S]*data-copy-markdown-button[\s\S]*class="copy-markdown-link"[\s\S]*<\/details>[\s\S]*<nav class="pager"/,
  );
});

test("the back-to-top link remains directly available after the grouped controls", () => {
  const page = out(pageWith());
  const article = /<article class="doc"[^>]*>(.*?)<\/article>/s.exec(page);
  assert.ok(article, "article present");
  assert.match(
    article[1] ?? "",
    /<div class="doc-actions article-tools">[\s\S]*<\/details><a class="back-to-top" href="#main">[\s\S]*<\/a><\/div><nav class="pager"/,
  );
  assert.ok((article[1] ?? "").indexOf('class="back-to-top"') < (article[1] ?? "").indexOf('<nav class="pager"'));
});

test("the breadcrumb leads the article and repeats the trail, end at the current page", () => {
  const trail = [
    { title: "Guides", url: "/guide/" },
    { title: "Install", url: "/guide/install/" },
  ];
  const page = out(pageWith(), [], trail);
  assert.match(page, /<article class="doc"[^>]*><div class="doc-context"><nav class="breadcrumb" aria-label="Breadcrumbs"><ol class="breadcrumb-list"><li class="breadcrumb-item"><a href="\/guide\/"><bdi class="breadcrumb-title">Guides<\/bdi><\/a><\/li>/);
  assert.match(page, /<span aria-current="page"><bdi class="breadcrumb-title">Install<\/bdi><\/span><\/li><\/ol><\/nav><details class="doc-tools"[\s\S]*?<h1>Install<\/h1>/);
});

test("the sidebar renders in the site-navigation column and the toc in its own navigation landmark", () => {
  const nav = [{ title: "Guides", children: [{ title: "Install", url: "/guide/install/" }] }];
  const page = out(pageWith({ headings: [heading(2, "Pick a mode"), heading(3, "Gem")] }), nav);
  assert.match(page, /<div class="sidebar" id="site-navigation"><nav class="sidebar-nav"/);
  assert.match(page, /<div class="aside"><nav class="toc" aria-labelledby="toc-title">/);
  assert.match(page, /<details class="toc-fold"><summary>On this page<\/summary>/);
});

const section = (depth: 2 | 3, text: string, id: string): Heading => ({ ...heading(depth, text), id });

test("the mobile section list sits at the start of the article and links the real sections", () => {
  const page = out(pageWith({ headings: [heading(1, "Install"), section(2, "Pick a mode", "pick-a-mode"), section(3, "Gem", "gem")] }));
  const article = /<article class="doc"[^>]*>([\s\S]*?)<\/article>/.exec(page);
  assert.ok(article, "article present");
  const body = article[1] ?? "";

  assert.match(
    body,
    /<details class="toc-fold"><summary>On this page<\/summary><ul><li><a href="#pick-a-mode">Pick a mode<\/a><ul><li><a href="#gem">Gem<\/a><\/li><\/ul><\/li><\/ul><\/details>/,
  );
  assert.ok(body.indexOf('class="toc-fold"') < body.indexOf('class="doc-body"'), "the section list leads the body");
  assert.doesNotMatch(body, /<details[^>]*\sopen(?:=|>)/, "the list starts closed");
});

test("the desktop aside keeps its list and the page carries one disclosure, not two", () => {
  const page = out(pageWith({ headings: [section(2, "Pick a mode", "pick-a-mode"), section(3, "Gem", "gem")] }));
  assert.equal((page.match(/<nav class="toc"/g) ?? []).length, 1);
  assert.equal((page.match(/class="toc-fold"/g) ?? []).length, 1);
  assert.match(page, /<div class="aside"><nav class="toc" aria-labelledby="toc-title">/);

  const css = readUiCss();
  const fold = /\.toc-fold\s*\{([^}]*)\}/.exec(css);
  assert.ok(fold, ".toc-fold is styled");
  assert.match(fold[1] ?? "", /display:\s*none/, "the fold is out of the desktop layout");
  const mobile = /@media \(max-width: 74rem\)\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(mobile, "the aside breakpoint exists");
  assert.match(mobile[1] ?? "", /\.aside\s*\{[^}]*display:\s*none/, "the aside is out below the breakpoint");
  assert.match(mobile[1] ?? "", /\.toc-fold\s*\{[^}]*display:\s*block/, "the folded list takes its place");
});

test("a page with fewer than two sections adds no section list anywhere", () => {
  for (const page of [pageWith({ headings: [] }), pageWith({ headings: [section(2, "Only", "only")] })]) {
    const rendered = out(page);
    assert.doesNotMatch(rendered, /class="toc-fold"/);
    assert.doesNotMatch(rendered, /<nav class="toc"/);
  }
});

test("the mobile section list keeps the page's language, direction, and localized label", () => {
  const page = out(
    pageWith({
      lang: "fa",
      dir: "rtl",
      headings: [section(2, "نصب", "install-fa"), section(3, "حالت‌ها", "states-fa")],
    }),
  );
  assert.match(page, /^<html lang="fa" dir="rtl"/);
  assert.match(page, /<details class="toc-fold"><summary>در این صفحه<\/summary>/);
  assert.match(page, /<a href="#install-fa">نصب<\/a>/);
  assert.match(page, /<a href="#states-fa">حالت‌ها<\/a>/);
});

test("the mobile section list is native markup that stays usable without JavaScript", () => {
  const page = out(pageWith({ headings: [section(2, "Pick a mode", "pick-a-mode"), section(3, "Gem", "gem")] }));
  const fold = /<details class="toc-fold">[\s\S]*?<\/details>/.exec(page)?.[0];
  assert.ok(fold, "the disclosure is rendered");

  assert.match(fold, /^<details class="toc-fold"><summary>/);
  assert.doesNotMatch(fold, /<script|<style|\son[a-z]+\s*=|\sdata-[a-z-]+=|\shidden\b/, "no script or JS-only state");
  for (const anchor of fold.matchAll(/<a\b[^>]*>/g)) {
    assert.match(anchor[0], /\shref="#[^"]+"/, "each entry is a plain same-page link");
  }
});

test("the sailcloth shell and the drawer share the header slot", () => {
  const nav = [{ title: "Guides", children: [{ title: "Install", url: "/guide/install/" }] }];
  const page = out(pageWith(), nav);
  assert.match(page, /<header class="site-header" data-site-header>/);
  const drawer = /<dialog class="drawer" data-drawer aria-label="Menu">([\s\S]*?)<\/dialog>/.exec(page);
  assert.ok(drawer, "drawer dialog present");
  assert.match(drawer?.[1] ?? "", /data-drawer-close/);
  assert.match(drawer?.[1] ?? "", /<nav class="sidebar-nav"/);
});

test("empty navigation leaves the sidebar and drawer out without breaking the page", () => {
  const page = out(pageWith());
  assert.doesNotMatch(page, /class="sidebar"/);
  assert.doesNotMatch(page, /dialog class="drawer"/);
  assert.doesNotMatch(page, /class="toc"/);
  assert.match(page, /^<html lang="en" dir="ltr"/);
  assert.match(page, /<a class="skip-link" href="#main">Skip to content<\/a>/);
});

test("the drift banner from site.data sits above the status banner and the title", () => {
  const data = { drift: { "/guide/install/": [{}, {}] } };
  const page = html(doc(layoutProps(pageWith({ frontMatter: { status: "beta" } }), [], [], data)));
  assert.match(page, /<aside class="drift-banner drift-banner-stale" role="note"[^>]*><svg[\s\S]*?2 drift findings<\/span>/);
  assert.ok(
    page.indexOf('class="drift-banner"') < page.indexOf('class="page-status'),
    "the drift banner comes before the status banner",
  );
  assert.ok(page.indexOf('class="drift-banner"') < page.indexOf("<h1>"), "the drift banner comes before the title");
  assert.doesNotMatch(html(doc(layoutProps(pageWith()))), /class="drift-banner"/);
});

test("the metadata group keeps trust, freshness, and reading time under the title", () => {
  const data = {
    trust: { "/guide/install/": { level: "verified", reasons: ["All examples passed."] } },
    "reading-time": [{ url: "/guide/install/", words: 100, minutes: 1 }],
  };
  const page = pageWith({ frontMatter: { last_modified_at: "2026-03-04" } });
  const rendered = html(doc(layoutProps(page, [], [], data)));
  assert.match(
    rendered,
    /<h1>Install<\/h1><div class="doc-meta"><details id="trust-panel" class="trust-panel trust-panel-verified"[\s\S]*?<\/details><p class="last-updated">[\s\S]*?<\/p><p class="reading-time"/,
  );
  assert.doesNotMatch(html(doc(layoutProps(pageWith()))), /class="trust-panel"/);
});

test("Source mode appears once inside Page tools", () => {
  const page = out(pageWith());
  assert.equal((page.match(/class="source-mode-button"/g) ?? []).length, 1);
  assert.match(page, /<details class="doc-tools"[^>]*><summary>Page tools[\s\S]*?class="source-mode-button"[\s\S]*?<\/details>/);
});

test("a quickstart prioritizes the prerequisites over reading metadata", () => {
  const page = out(pageWith({ frontMatter: { quickstart: true } }));
  assert.match(page, /<div class="doc-body" data-quickstart>/);
  assert.doesNotMatch(page, /class="doc-meta"/);
});

test("the status banner from front matter sits between the breadcrumb and the title", () => {
  const page = out(pageWith({ frontMatter: { status: "beta" } }));
  assert.match(
    page,
    /<article class="doc"[^>]*><div class="doc-context">[\s\S]*?<div class="page-status page-status-beta" role="note"><strong class="page-status-label">Beta<\/strong>[\s\S]*?<\/div><h1>Install<\/h1>/,
  );
});

test("the feedback disclosure includes edit and report links when a repository is configured", () => {
  const page = pageWith();
  const rendered = html(doc(layoutProps(page, [], [], {}, { url: "https://github.com/o/r" })));

  assert.match(
    rendered,
    /<summary>Feedback[\s\S]*?<div class="edit-page" data-edit-page><a class="edit-page-link" href="https:\/\/github\.com\/o\/r\/edit\/main\/guide\/install\.md" rel="noopener">Edit this page<\/a><\/div>[\s\S]*?Report a problem/,
  );
  assert.doesNotMatch(html(doc(layoutProps(page))), /class="edit-page"|<summary>Feedback/);
});

test("a page date and edit link appear once, not again in the footer", () => {
  const page = pageWith({ frontMatter: { last_modified_at: "2026-03-04" } });
  const rendered = html(doc(layoutProps(page, [], [], {}, { url: "https://github.com/o/r" })));

  assert.equal(rendered.match(/data-date-source="source"/g)?.length, 1);
  assert.equal(rendered.match(/class="edit-page-link"/g)?.length, 1);
  assert.doesNotMatch(rendered, /page-footer-meta|page-footer-edit|page-footer-updated/);
});

test("the banner shows `since`, and a deprecated page links to its replacement", () => {
  const page = out(
    pageWith({ frontMatter: { status: "deprecated", since: "0.3.0", replaced_by: "/guide/new-install/" } }),
  );
  assert.match(page, /<span class="page-status-since">Since 0\.3\.0<\/span>/);
  assert.match(
    page,
    /<a class="page-status-replacement" href="\/guide\/new-install\/">Go to the replacement<\/a>/,
  );
});

test("the banner renders above the body's own h1, which the layout still leaves out", () => {
  const page = out(
    pageWith({ frontMatter: { status: "experimental" }, headings: [heading(1, "Install")] }),
  );
  assert.match(page, /class="page-status page-status-experimental"/);
  assert.doesNotMatch(page, /<h1>/);
});

test("a status with no banner, and a non-string `since`, leave the page as they found it", () => {
  const page = out(pageWith({ frontMatter: { status: "accepted", since: 3 } }));
  assert.doesNotMatch(page, /page-status/);
  assert.match(page, /<article class="doc"[^>]*><div class="doc-context">[\s\S]*?<h1>Install<\/h1>/);
});

test("a page with tool: renders the tool, its module, and its fallback", () => {
  const page = out(pageWith({ frontMatter: { tool: "tool/sample.js" } }));
  assert.match(page, /<section class="page-tool" aria-labelledby="page-tool-title">/);
  assert.match(page, /<p class="page-tool-fallback">/);
  assert.match(page, /<script type="module" src="\/tool\/sample\.js"><\/script>/);
});

test("a page without tool: renders exactly as before", () => {
  const page = out(pageWith());
  assert.doesNotMatch(page, /page-tool/);
  assert.doesNotMatch(page, /<script type="module"/);
});

test("the tool URL keeps a nested base path", () => {
  const props = layoutProps(pageWith({ frontMatter: { tool: "tool/sample.js" } }));
  const nested = { ...props, site: { ...props.site, config: configWith({ base: "/lateen" }) } };
  const page = html(doc(nested));
  assert.match(page, /href="\/lateen\/tool\/sample\.js"/);
  assert.match(page, /src="\/lateen\/tool\/sample\.js"/);
});
