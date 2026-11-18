import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import galleryFilters from "../components/gallery-filters/index.ts";

const render = (props: Parameters<typeof galleryFilters>[0]): string =>
  renderToString(galleryFilters(props) as never);

const facets = [
  {
    field: "status",
    values: [
      { value: "done", count: 2 },
      { value: "draft", count: 1 },
    ],
  },
];

test("each facet is a group of links with its value and the number of matching records", () => {
  const out = render({ facets, sorts: [], url: "/gallery/", selected: new Map(), lang: "en" });
  assert.match(out, /<nav class="gallery-facets" aria-label="Filters">/);
  assert.match(out, /<fieldset class="gallery-facet"><legend>status<\/legend>/);
  assert.match(out, /href="\/gallery\/\?filter\.status=done"[^>]*>done \(2\)<\/a>/);
  assert.match(out, /href="\/gallery\/\?filter\.status=draft"[^>]*>draft \(1\)<\/a>/);
});

test("a chosen value is marked and links back to the address without it", () => {
  const out = render({
    facets,
    sorts: [],
    url: "/gallery/?filter.status=done",
    selected: new Map([["status", "done"]]),
    lang: "en",
  });
  assert.match(out, /class="gallery-filter-value gallery-filter-selected" href="\/gallery\/"/);
  assert.match(out, /aria-current="true">done \(2\)<\/a>/);
  assert.match(out, /href="\/gallery\/\?filter\.status=draft"[^>]*>draft \(1\)<\/a>/);
});

test("the clear link removes every filter and keeps the sort", () => {
  const out = render({
    facets,
    sorts: ["title"],
    url: "/gallery/?filter.status=done&filter.topic=api&sort=title&order=desc",
    selected: new Map([
      ["status", "done"],
      ["topic", "api"],
    ]),
    sort: { field: "title", direction: "desc" },
    lang: "en",
  });
  assert.match(out, /class="gallery-filter-clear" href="\/gallery\/\?sort=title&amp;order=desc"/);
  assert.match(out, />Clear filters<\/a>/);
});

test("a facet with no values renders no group and still offers the clear link", () => {
  const out = render({
    facets: [{ field: "status", values: [] }],
    sorts: [],
    url: "/gallery/?filter.status=missing",
    selected: new Map([["status", "missing"]]),
    lang: "en",
  });
  assert.doesNotMatch(out, /<fieldset/);
  assert.match(out, /gallery-filter-clear/);
});

test("boolean values read as words and numbers use the page's digits", () => {
  const out = render({
    facets: [{ field: "featured", values: [{ value: "true", count: 1204 }] }],
    sorts: [],
    url: "/gallery/",
    selected: new Map(),
    lang: "fa",
  });
  assert.match(out, /بله \(۱٬۲۰۴\)/);
});
