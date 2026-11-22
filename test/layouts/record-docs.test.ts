// The page is the reference a reader copies, so every option it documents must be one the layout
// reads. The layout runs with a recording proxy, so the compared list comes from the reads and not
// from a second copy in the test (#238).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToString } from "preact-render-to-string";
import { test } from "node:test";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import record from "../../layouts/record.ts";
import { FIELD_KINDS } from "../../src/fields.ts";

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("site/layouts/record.md");

const pos: SourcePos = { file: "books/alpha.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
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
} as SiteConfig;

function layoutProps(frontMatter: Record<string, unknown>): LayoutProps {
  const current: Page = {
    url: "/books/alpha/",
    source: pos,
    frontMatter,
    title: "Alpha",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>An invented record.</p>",
    markdown: "An invented record.",
    kind: "doc",
    record: {
      collection: "books",
      id: "alpha",
      url: "/books/alpha/",
      position: pos,
      fields: { summary: "A short invented handbook.", status: "shipped", pages: 320, published: "2026-01-12", format: "hardcover" },
      links: {},
    },
  } as unknown as Page;
  const site: Site = { config, pages: [current], nav: {}, data: {}, collections: {} };
  return {
    site,
    page: current,
    trail: [],
    pager: {},
    head: { title: "Alpha · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    record: current.record,
  } as unknown as LayoutProps;
}

/** The front-matter paths read while the layout runs. */
function readsOf(frontMatter: Record<string, unknown>): string[] {
  const reads = new Set<string>();
  const seen = new WeakMap<object, unknown>();
  const spy = (value: unknown, path: string): unknown => {
    if (typeof value !== "object" || value === null) return value;
    const known = seen.get(value);
    if (known !== undefined) return known;
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const child = Reflect.get(target, key, receiver);
        if (typeof key !== "string") return child;
        if (Array.isArray(target)) return /^\d+$/.test(key) ? spy(child, `${path}[]`) : child;
        if (!Object.prototype.hasOwnProperty.call(target, key)) return child;
        const childPath = path === "" ? key : `${path}.${key}`;
        reads.add(childPath);
        return spy(child, childPath);
      },
    });
    seen.set(value, proxy);
    return proxy;
  };
  renderToString(record(layoutProps(spy(frontMatter, "") as Record<string, unknown>)) as never);
  return [...reads];
}

/** The backticked names in the first column of the table under `## <heading>`. */
function documented(heading: string): string[] {
  const section = page.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1] ?? "");
}

const SAMPLE: Record<string, unknown> = {
  record: {
    facts: [{ field: "pages", label: "Pages", kind: "number", group: "Details" }],
    summary: "summary",
    status: "status",
    report: true,
  },
};

test("the page documents exactly the record keys the layout reads", () => {
  const keys = readsOf(SAMPLE);
  const top = keys
    .filter((name) => name.startsWith("record.") && !name.startsWith("record.facts["))
    .map((name) => name.slice("record.".length))
    .sort();
  const facts = keys
    .filter((name) => name.startsWith("record.facts[]."))
    .map((name) => name.slice("record.facts[].".length))
    .sort();
  assert.deepEqual(documented("Record options").sort(), top);
  assert.deepEqual(documented("Fact entries").sort(), facts);
});

test("the page documents exactly the field kinds the formatter accepts", () => {
  assert.deepEqual(documented("Fact kinds").sort(), [...FIELD_KINDS].sort());
});

test("the page links a live record and explains the no-JavaScript behaviour", () => {
  assert.match(page, /\[Alpha\]\(\/books\/alpha\/\)/);
  assert.match(page, /^## Without JavaScript$/m);
  assert.match(read("site/_templates/books.md"), /^layout: record$/m);
  assert.match(read("site/mizzen.yml"), /^    template: _templates\/books\.md$/m);
});

test("the layouts index and the navigation link the page", () => {
  assert.match(read("site/layouts.md"), /\[Record layout\]\(\/layouts\/record\/\)/);
  assert.match(read("site/_data/navigation.yml"), /title: Record layout\n\s+url: \/layouts\/record\//);
});
