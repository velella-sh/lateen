import assert from "node:assert/strict";
import { test } from "node:test";
import { Fragment, h } from "preact";
import { JSDOM } from "jsdom";
import type { Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import shell, { footer } from "../../../chrome/shell/index.ts";
import { boot, historyNavigation, readPosition, savePosition, searchPages, themeColor, readingProgress } from "../../../chrome/shell/client.ts";

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
    repository: { url: "https://github.com/velella-sh/lateen" },
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
  assert.doesNotMatch(out, /brand-tag|href="https:\/\/github.com\/velella-sh\/lateen"/);
  const defaultFooter = html(footer({ site }));
  assert.match(defaultFooter, /site-footer/);
  assert.match(defaultFooter, /<a href="https:\/\/github.com\/velella-sh\/lateen">GitHub<\/a>/);

  const logoSite = {
    ...site,
    config: {
      ...site.config,
      base: "/docs",
      theme: { options: { logo: { light: "/brand/light.svg", dark: "/brand/dark.svg" } } },
    },
  };
  const logoOut = html(shell({ site: logoSite, page, trail: [], pager: {} }));
  assert.match(logoOut, /class="brand-logo-frame"/);
  assert.match(logoOut, /src="\/docs\/brand\/light.svg"/);
  assert.match(logoOut, /src="\/docs\/brand\/dark.svg"/);
  const logoFooter = html(footer({ site: logoSite }));
  assert.doesNotMatch(logoFooter, /class="footer-name"/);
  const sparseFooter = html(footer({
    site: { ...site, config: { ...config, base: "/docs", theme: { options: { footer: { links: [] } } } } },
  }));
  assert.doesNotMatch(sparseFooter, /class="footer-name"/, "the configured repository provides a footer link");
  const { repository: _repository, ...withoutRepository } = config;
  const emptyFooter = html(footer({
    site: { ...site, nav: {}, config: { ...withoutRepository, base: "/docs" } },
  }));
  assert.match(emptyFooter, /<a class="footer-name" href="\/docs\/">Lateen<\/a>/);
  assert.doesNotMatch(logoFooter, /brand-logo|brand-mark|<img/);

  const footerSite = {
    ...site,
    config: {
      ...site.config,
      base: "/another-docs",
      repository: { url: "https://gitlab.com/team/example" },
      theme: { options: { footer: { links: [
        { title: "Install", url: "/install/" },
        { title: "Source", url: "https://gitlab.com/team/example/" },
        { title: "Issues", url: "https://gitlab.com/team/example/issues" },
        { title: "Bad", url: "javascript:alert(1)" },
      ] } } },
    },
  };
  const footerOut = html(footer({ site: footerSite }));
  assert.match(footerOut, /<a href="\/another-docs\/install\/">Install<\/a>/);
  assert.match(footerOut, /<a href="https:\/\/gitlab\.com\/team\/example\/">Source<\/a>/);
  assert.match(footerOut, /<a href="https:\/\/gitlab\.com\/team\/example\/issues">Issues<\/a>/);
  assert.doesNotMatch(footerOut, />Repository<\/a>/);
  assert.doesNotMatch(footerOut, /javascript:/);
});

test("shell client helpers search, theme color, and progress", () => {
  assert.equal(themeColor("dark"), "#23212c");
  assert.equal(themeColor("light"), "#f4f4f9");
  assert.equal(searchPages([{ title: "Install", description: "guide", url: "/i/" }], "inst")[0]?.url, "/i/");
  assert.ok(readingProgress(100, 0, 500, 200) >= 0);
});

/** A JSDOM window for a path, with frame and clock queues the test drives by hand. */
function readerWindow(t: { after(fn: () => void): void }, path: string) {
  const { window } = new JSDOM("<header data-site-header></header>", { url: `https://example.com${path}` });
  t.after(() => window.close());
  const timers: Array<() => void> = [];
  const frames: FrameRequestCallback[] = [];
  const scrolled: number[] = [];
  Object.defineProperty(window, "setTimeout", { value: (callback: () => void) => timers.push(callback) });
  Object.defineProperty(window, "requestAnimationFrame", { value: (callback: FrameRequestCallback) => frames.push(callback) });
  Object.defineProperty(window, "scrollTo", { value: (_x: number, y: number) => scrolled.push(y) });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  return { window, timers, frames, scrolled };
}

function navigation(window: Window, type: string): void {
  Object.defineProperty(window.performance, "getEntriesByType", { value: () => [{ type }], configurable: true });
}

test("shell saves the reading position per path and restores it after Back", (t) => {
  const { window, timers, frames, scrolled } = readerWindow(t, "/guide/");
  navigation(window as unknown as Window, "back_forward");
  boot(window as unknown as Window);

  Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
  window.dispatchEvent(new window.Event("scroll"));
  window.dispatchEvent(new window.Event("scroll"));
  assert.equal(timers.length, 1, "scroll writes are throttled");
  timers.shift()!();
  assert.equal(readPosition(window.sessionStorage, "/guide/"), 640);
  assert.equal(readPosition(window.sessionStorage, "/install/"), null);
  frames.length = 0; // drop the progress frame the scroll scheduled

  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: false }));
  window.dispatchEvent(new window.Event("load"));
  frames.shift()!(0);
  assert.deepEqual(scrolled, [640]);
});

test("shell does not restore on a fresh visit or a reload", (t) => {
  const { window, frames, scrolled } = readerWindow(t, "/guide/");
  navigation(window as unknown as Window, "back_forward");
  boot(window as unknown as Window);

  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: false }));
  window.dispatchEvent(new window.Event("load"));
  assert.equal(frames.length, 0);

  savePosition(window.sessionStorage, "/guide/", 640);
  navigation(window as unknown as Window, "reload");
  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: false }));
  window.dispatchEvent(new window.Event("load"));
  assert.equal(frames.length, 0);
  assert.deepEqual(scrolled, []);

  navigation(window as unknown as Window, "back_forward");
  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: true }));
  assert.equal(frames.length, 0, "a bfcache page keeps the position the browser restored");
});

test("shell does not share a reading position between paths", (t) => {
  const { window, frames, scrolled } = readerWindow(t, "/install/");
  savePosition(window.sessionStorage, "/guide/", 640);
  assert.equal(readPosition(window.sessionStorage, "/install/"), null);
  navigation(window as unknown as Window, "back_forward");
  boot(window as unknown as Window);

  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: false }));
  window.dispatchEvent(new window.Event("load"));
  assert.equal(frames.length, 0);
  assert.deepEqual(scrolled, []);
  assert.equal(historyNavigation(window as unknown as Window), true);
});
