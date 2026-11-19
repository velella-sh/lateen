import assert from "node:assert/strict";
import { test } from "node:test";
import { Fragment, h } from "preact";
import { JSDOM } from "jsdom";
import type { Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import shell, { footer } from "../chrome/shell/index.ts";
import { boot, searchPages, themeColor, readingProgress } from "../chrome/shell/client.ts";

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

test("the shell batches scroll and resize updates into one frame", (t) => {
  const { window } = new JSDOM("<header data-site-header></header><div data-progress></div><main id=main></main>");
  t.after(() => window.close());
  const { document } = window;
  const header = document.querySelector("header")!;
  const progress = document.querySelector<HTMLElement>("[data-progress]")!;
  const main = document.querySelector("main")!;
  Object.defineProperty(main, "scrollHeight", { value: 1000 });
  Object.defineProperty(window, "innerHeight", { value: 600 });
  const frames: FrameRequestCallback[] = [];
  window.requestAnimationFrame = (callback) => frames.push(callback);
  boot(window as unknown as Window);

  Object.defineProperty(window, "scrollY", { value: 160 });
  window.dispatchEvent(new window.Event("scroll"));
  window.dispatchEvent(new window.Event("scroll"));
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(frames.length, 1);
  assert.equal(header.classList.contains("is-scrolled"), false);
  frames.shift()!(0);
  assert.equal(progress.style.transform, "scaleX(0.5)");
  assert.equal(progress.classList.contains("is-on"), true);
  assert.equal(header.classList.contains("is-scrolled"), true);
});

function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(html).join("");
  if (typeof node !== "object" || node === null || !("type" in node)) return "";
  const n = node as { type: unknown; props: Record<string, unknown> };
  if (n.type === Fragment) return html(n.props.children);
  if (typeof n.type === "function") return html((n.type as (p: object) => unknown)(n.props));
  const tag = n.type as string;
  const { children, dangerouslySetInnerHTML, ...rest } = n.props as {
    children?: unknown;
    dangerouslySetInnerHTML?: { __html: string };
  };
  const attrs = Object.entries(rest)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${String(v)}"`))
    .join("");
  if (tag === "meta" || tag === "link" || tag === "input") return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children)}</${tag}>`;
}

test("shell renders sailcloth header chrome with search trigger", () => {
  const page: Page = {
    url: "/",
    source: pos,
    frontMatter: {},
    title: "Home",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
  };
  const config: SiteConfig = {
    title: "Lateen",
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
  };
  const site: Site = {
    config,
    pages: [page],
    nav: {
      main: [
        { title: "Start", children: [{ title: "Overview", url: "/" }] },
        { title: "Components", children: [{ title: "Component reference", url: "/components/" }] },
        { title: "Customize", children: [{ title: "Tokens and options", url: "/tokens/" }] },
      ],
    },
    data: {},
    collections: {},
  };
  const out = html(shell({ site, page, trail: [], pager: {} }));
  assert.match(out, /data-site-header/);
  assert.match(out, /<a href="\/components\/">Components<\/a>/);
  assert.match(out, /<a href="\/tokens\/">Customize<\/a>/);
  assert.match(out, /search-trigger/);
  assert.match(out, /data-search-open/);
  assert.match(out, /data-drawer-open/);
  assert.match(out, /data-theme-toggle/);
  assert.match(html(footer({ site })), /site-footer/);
});

test("shell client helpers search, theme color, and progress", () => {
  assert.equal(themeColor("dark"), "#23212c");
  assert.equal(themeColor("light"), "#f4f4f9");
  assert.equal(searchPages([{ title: "Install", description: "guide", url: "/i/" }], "inst")[0]?.url, "/i/");
  assert.ok(readingProgress(100, 0, 500, 200) >= 0);
});
