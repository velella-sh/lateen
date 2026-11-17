import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import recordLayout from "../layouts/record.ts";
import { bodyOf, titleOf } from "../chrome/report-issue/index.ts";

const pos: SourcePos = { file: "components/button.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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
  repository: { url: "https://github.com/velella-sh/lateen" },
  theme: { options: {} },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
} as unknown as SiteConfig;

const RECORD = {
  collection: "components",
  id: "button",
  url: "/components/button/",
  template: "_templates/components.md",
  templateLine: 1,
  fallbacks: [],
  position: { file: "_data/components.yml", startLine: 2, startColumn: 1, endLine: 4, endColumn: 1 },
  fields: { name: "Button", status: "stable" },
  links: {},
} as unknown as NonNullable<Page["record"]>;

function render(lang = "en", report: unknown = null): string {
  const page = {
    url: "/components/button/",
    source: pos,
    frontMatter: { record: { report, facts: [{ field: "name", label: "Name" }, { field: "status", label: "Status" }] } },
    title: "Button",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
    headings: [],
    html: "<p>A control.</p>",
    markdown: "A control.",
    kind: "doc",
  } as Page;
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  const props = {
    site,
    page,
    record: RECORD,
    trail: [],
    pager: {},
    head: { title: "Button · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
  } as unknown as LayoutProps;
  return renderToString(recordLayout(props) as never);
}

const reportLinks = (out: string) =>
  [...out.matchAll(/<a class="report-issue-link record-fact-report" [^>]*>(?:[^<]*)<\/a>/g)].map((match) => match[0]);

test("a page without the option gains no report links", () => {
  assert.equal(reportLinks(render("en", undefined)).length, 0);
  assert.equal(reportLinks(render("en", false)).length, 0);
});

test("the option adds one quiet link per fact, named after the fact", () => {
  const out = render("en", true);
  const links = reportLinks(out);
  assert.equal(links.length, 2);
  assert.match(out, /<a class="report-issue-link record-fact-report" href="https:\/\/github\.com\/velella-sh\/lateen\/issues\/new[^"]*"[^>]*aria-label="Report this value: Name">Report this value<\/a>/);
  assert.match(links[1]!, /aria-label="Report this value: Status"/);
  assert.doesNotMatch(links[0]!, /target=/);
  assert.match(links[0]!, /rel="noopener"/);
});

test("the link is translated and keeps the fact's name", () => {
  const out = render("fa", true);
  assert.match(out, /aria-label="گزارش این مقدار: Name">گزارش این مقدار<\/a>/);
});

test("the issue names the field in its title and body", () => {
  const page = {
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
    record: RECORD,
  } as Page;
  assert.equal(titleOf(page, undefined, "Name"), "Button: Name");
  assert.match(bodyOf(page, config.repository, "Name"), /^I found a problem with this data\.\n\nPage: \/components\/button\/\nField: Name\n/);
});
