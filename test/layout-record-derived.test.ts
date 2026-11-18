import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, RecordProps, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../layouts/list.ts";
import record from "../layouts/record.ts";
import { sortKey, sortRows } from "../src/sort.ts";

const pos: SourcePos = { file: "releases/soon.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

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
  theme: {
    options: {
      status: {
        values: {
          soon: { tone: "caution", label: { en: "Soon" } },
          expired: { tone: "negative", label: { en: "Expired" } },
        },
      },
    },
  },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
} as unknown as SiteConfig;

const facts = [
  { field: "derived.daysLeft", label: "Days left", kind: "days" },
  { field: "derived.state", label: "State", kind: "status" },
];

function pageWith(frontMatter: Record<string, unknown>, url = "/releases/soon/"): Page {
  return {
    url,
    source: pos,
    frontMatter,
    title: "Soon",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>One release.</p>",
    markdown: "One release.",
    kind: "doc",
  } as unknown as Page;
}

function propsOf(page: Page, value: RecordProps | undefined): LayoutProps {
  const site: Site = {
    config,
    pages: [page],
    nav: {},
    data: {},
    collections: {},
  };
  return {
    site,
    page,
    trail: [{ title: "Releases", url: "/releases/" }],
    pager: {},
    head: { title: page.title, meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(value === undefined ? {} : { record: value }),
  } as unknown as LayoutProps;
}

const derivedRecord: RecordProps = {
  collection: "releases",
  id: "soon",
  url: "/releases/soon/",
  fields: { title: "Soon" },
  links: {},
  derived: { daysLeft: 10, state: "soon" },
};

const plainRecord: RecordProps = {
  collection: "releases",
  id: "soon",
  url: "/releases/soon/",
  fields: { title: "Soon" },
  links: {},
};

test("a fact reads a derived value and a derived status uses the site's one map", () => {
  const page = pageWith({ record: { status: "derived.state", facts } });
  const out = renderToString(record(propsOf(page, derivedRecord)) as never);

  assert.match(out, />Days left<\/dt>/);
  assert.match(out, />10 days left<\/dd>/);
  assert.match(out, />State<\/dt>/);
  assert.match(out, /class="record-status"><span class="field-status" data-value="soon"/);
  assert.match(out, /class="status status-caution"/);
  assert.match(out, />Soon<\/span>/);
});

test("a record without derived values still renders, with no derived fact or status", () => {
  const page = pageWith({ record: { status: "derived.state", facts } });
  const out = renderToString(record(propsOf(page, plainRecord)) as never);

  assert.match(out, /<article class="record"/);
  assert.match(out, /<div class="record-body"><p>One release.<\/p><\/div>/);
  assert.doesNotMatch(out, />Days left<\/dt>/);
  assert.doesNotMatch(out, />State<\/dt>/);
  assert.doesNotMatch(out, /class="record-status"/);
});

const tableRecord = (id: string, derived?: Record<string, unknown>): RecordProps => ({
  collection: "releases",
  id,
  url: `/releases/${id}/`,
  fields: { title: id },
  links: {},
  ...(derived === undefined ? {} : { derived }),
});

const tableRecords = [
  tableRecord("soon", { daysLeft: 10, state: "soon" }),
  tableRecord("past", { daysLeft: -2, state: "expired" }),
  tableRecord("bare"),
];

function listPage(): Page {
  return pageWith(
    {
      list: {
        collection: "releases",
        columns: [
          { field: "title", label: "Title" },
          { field: "derived.daysLeft", label: "Days left", kind: "days", filter: true },
          { field: "derived.state", label: "State", kind: "status" },
        ],
      },
    },
    "/releases/",
  );
}

function listProps(): LayoutProps {
  const page = listPage();
  const props = propsOf(page, undefined);
  return {
    ...props,
    list: { collection: "releases", records: tableRecords, groups: [], pagination: { page: 1, total: 1 } },
  } as LayoutProps;
}

test("a list column reads and sorts a derived value", () => {
  const out = renderToString(list(listProps()) as never);

  assert.match(out, /<th scope="col" data-field="derived\.daysLeft" data-kind="days" data-label="Days left"/);
  assert.match(out, /<td class="record-table-cell" data-kind="days" data-value="10">10 days left<\/td>/);
  assert.match(out, /<td class="record-table-cell" data-kind="days" data-value="-2">2 days ago<\/td>/);
  assert.match(out, /<option value="10">10<\/option>/);
  assert.match(out, /<option value="-2">-2<\/option>/);

  // The island sorts the raw values by the `days` kind, so a past date comes before a future one.
  const raw = ["10", "-2"];
  assert.deepEqual(sortRows(raw, (value) => sortKey(value, "days"), "days", "ascending", "en"), ["-2", "10"]);
  assert.deepEqual(sortRows(raw, (value) => sortKey(value, "days"), "days", "descending", "en"), ["10", "-2"]);
});

test("a derived column renders a placeholder when one record has no value", () => {
  const out = renderToString(list(listProps()) as never);

  assert.match(out, /<td class="record-table-cell" data-kind="days"><span class="field-empty">No value<\/span><\/td>/);
  assert.doesNotMatch(out, /No field named &quot;derived\.daysLeft&quot;/);
});
