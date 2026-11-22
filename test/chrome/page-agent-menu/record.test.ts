import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import pageAgentMenu from "../../../chrome/page-agent-menu/index.ts";
import { expand, jsonUrl } from "../../../chrome/page-agent-menu/providers.ts";

const pos: SourcePos = { file: "components/button.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

function config(options: Readonly<Record<string, unknown>> = {}): SiteConfig {
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
    url: "https://example.com",
    theme: { options },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
  } as unknown as SiteConfig;
}

function page(overrides: Partial<Page> = {}): Page {
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: {},
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  } as Page;
}

const record = { collection: "components", id: "button", url: "/components/button/", fields: {}, links: {} } as unknown as NonNullable<Page["record"]>;

const render = (subject: Page, options: Readonly<Record<string, unknown>> = {}) => {
  const site: Site = { config: config(options), pages: [subject], nav: {}, data: {}, collections: {} };
  return renderToString(pageAgentMenu({ page: subject, site, props: {}, html: "" } as unknown as ChromeProps) as never);
};

test("a record page offers its JSON beside its Markdown", () => {
  const out = render(page({ record }));
  assert.match(out, /<a class="page-agent-menu-view" href="\/components\/button\/index.md">View Markdown<\/a>/);
  assert.match(out, /<a class="page-agent-menu-view" href="\/components\/button\/index.json" data-page-agent-json="true">View as JSON<\/a>/);
});

test("a page without a record offers no JSON link", () => {
  const out = render(page());
  assert.match(out, /View Markdown/);
  assert.doesNotMatch(out, /data-page-agent-json/);
});

test("the json placeholder fills on a record page and follows the page language", () => {
  const out = render(page({ record, lang: "fa" }), {
    pageAgent: { providers: [{ title: "Reader", url: "https://example.org/read?json={json}" }] },
  });
  assert.match(out, /href="https:\/\/example\.org\/read\?json=https%3A%2F%2Fexample\.com%2Fcomponents%2Fbutton%2Findex\.json"/);
  assert.match(out, /مشاهده به صورت JSON/);
});

test("a template asking for json is left out when the URL names a file with no JSON", () => {
  const subject = page({ url: "/notes.txt", record });
  const options = { pageAgent: { providers: [{ title: "Reader", url: "https://example.org/read?json={json}" }] } };
  assert.equal(expand(config(options), subject, "https://example.org/read?json={json}", "/notes.md"), undefined);
  assert.doesNotMatch(render(subject, options), /example\.org\/read/);
});

test("the JSON rule matches the engine's output address", () => {
  assert.equal(jsonUrl("/guide/install/"), "/guide/install/index.json");
  assert.equal(jsonUrl("/guide/install"), "/guide/install/index.json");
  assert.equal(jsonUrl("/404.html"), "/404.json");
  assert.equal(jsonUrl("/notes.txt"), undefined);
});
