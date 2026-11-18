// The stale notice appears in the four article layouts through one shared slot, under the title,
// and nowhere else. A page without `stale`, or a site that turned the notice off, is unchanged.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, PageStale, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import doc from "../layouts/doc.ts";
import guide from "../layouts/guide.ts";
import home from "../layouts/home.ts";
import record from "../layouts/record.ts";
import tutorial from "../layouts/tutorial.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const stale: PageStale = {
  reviewed: "2026-01-05",
  files: [
    { path: "src/router.ts", change: "changed" },
    { path: "src/old.ts", change: "removed" },
    { path: "src/new.ts", change: "added" },
    { path: "src/four.ts", change: "changed" },
    { path: "src/five.ts", change: "changed" },
    { path: "src/six.ts", change: "changed" },
  ],
};

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
    url: "https://example.com",
    repository: { url: "https://github.com/example/repo", branch: "main" },
    ...overrides,
  } as unknown as SiteConfig;
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
  } as Page;
}

function props(page: Page, config: SiteConfig = configWith()): LayoutProps {
  const site: Site = {
    config,
    pages: [page],
    nav: { main: [{ title: "Guide", url: "/guide/" }] },
    data: {},
    collections: {},
  };
  return {
    site,
    page,
    trail: [{ title: "Guide", url: "/guide/" }, { title: page.title, url: page.url }],
    pager: { prev: { title: "Overview", url: "/guide/" }, next: { title: "Configure", url: "/guide/configure/" } },
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
    islands: [],
    record: { collection: "items", id: "install", url: page.url, fields: {}, links: {} },
  } as unknown as LayoutProps;
}

const render = (layout: typeof doc, page: Page, config = configWith()): string =>
  renderToString(layout(props(page, config)) as never);

const noticeAt = (html: string): number => html.indexOf('class="stale-notice"');

test("the four article layouts show the notice under the title", () => {
  for (const layout of [doc, tutorial, guide, record]) {
    const html = render(layout, pageWith({ stale }));
    const notice = noticeAt(html);
    const title = html.indexOf("</h1>");
    assert.ok(notice !== -1, `${layout.name} shows the notice`);
    assert.ok(title !== -1 && title < notice, `${layout.name} places it after the title`);
    assert.match(html.slice(notice), /This page may be out of date/);
    assert.match(html.slice(notice), /src\/router\.ts/);
  }
});

test("a page without stale renders exactly as before", () => {
  const off = configWith({ theme: { options: { stale: { show: false } } } });
  for (const layout of [doc, tutorial, guide, record]) {
    const plain = render(layout, pageWith({}));
    assert.equal(noticeAt(plain), -1);
    assert.equal(render(layout, pageWith({ stale }), off), plain);
  }
});

test("the site can turn the notice off", () => {
  for (const layout of [doc, tutorial, guide, record]) {
    const html = render(layout, pageWith({ stale }), configWith({ theme: { options: { stale: { show: false } } } }));
    assert.equal(noticeAt(html), -1);
  }
});

test("the notice offers the edit link and an agent prompt with the changed files", () => {
  const config = configWith({
    theme: {
      options: {
        pageAgent: {
          providers: [
            { title: "Agent", url: "https://agent.example/ask?q={prompt}" },
            { title: "Read only", url: "https://agent.example/read?u={markdown}" },
          ],
        },
      },
    },
  } as unknown as Partial<SiteConfig>);
  const page = new JSDOM(`<!doctype html><html><body>${render(doc, pageWith({ stale }), config)}</body></html>`).window.document;
  const actions = [...page.querySelectorAll(".stale-notice-actions a")];
  assert.deepEqual(actions.map((link) => link.textContent), ["Update this page", "Ask an agent"]);
  assert.equal(actions[0]!.getAttribute("href"), "https://github.com/example/repo/edit/main/guide/install.md");
  assert.match(decodeURIComponent(actions[1]!.getAttribute("href")!), /src\/router\.ts/);
  assert.match(decodeURIComponent(actions[1]!.getAttribute("href")!), /src\/six\.ts/);
  assert.equal(actions[1]!.getAttribute("href")!.includes("read"), false, "a provider without a prompt placeholder is not used");

  const noRepository = new JSDOM(
    `<!doctype html><html><body>${render(doc, pageWith({ stale }), configWith({ repository: undefined, theme: config.theme } as unknown as Partial<SiteConfig>))}</body></html>`,
  ).window.document;
  assert.equal(noRepository.querySelector(".stale-notice-actions a")?.textContent, "Ask an agent");
});

test("other layouts ignore stale", () => {
  const plain = renderToString(home(props(pageWith({}))) as never);
  const marked = renderToString(home(props(pageWith({ stale }))) as never);
  assert.equal(noticeAt(plain), -1);
  assert.equal(plain, marked);
});
