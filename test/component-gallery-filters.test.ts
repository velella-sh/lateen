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

test("the reset button appears only while a filter is active", () => {
  const idle = render({ facets, sorts: [], url: "/gallery/", selected: new Map(), lang: "en" });
  assert.match(idle, /<button[^>]*data-gallery-clear[^>]*hidden>Clear filters<\/button>/);
  const active = render({
    facets,
    sorts: [],
    url: "/gallery/?filter.status=done",
    selected: new Map([["status", "done"]]),
    lang: "en",
  });
  assert.doesNotMatch(active, /<button[^>]*hidden/);
});

test("the reset is a GET form that clears every filter and keeps the sort without script", () => {
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
  assert.match(out, /<form class="gallery-filter-reset" method="get" action="\/gallery\/">/);
  assert.match(out, /<input type="hidden" name="sort" value="title"/);
  assert.match(out, /<input type="hidden" name="order" value="desc"/);
  assert.match(out, /<button[^>]*type="submit"[^>]*>Clear filters<\/button>/);
});

test("the reset label reads in the page's language, including right-to-left pages", () => {
  const active = (lang: string): string =>
    render({
      facets,
      sorts: [],
      url: "/gallery/?filter.status=done",
      selected: new Map([["status", "done"]]),
      lang,
    });
  assert.match(active("fa"), />پاک کردن فیلترها<\/button>/);
  assert.match(active("ar"), />مسح عوامل التصفية<\/button>/);
});

test("a facet with no values renders no group and still offers the reset when a filter is active", () => {
  const out = render({
    facets: [{ field: "status", values: [] }],
    sorts: [],
    url: "/gallery/?filter.status=missing",
    selected: new Map([["status", "missing"]]),
    lang: "en",
  });
  assert.doesNotMatch(out, /<fieldset/);
  assert.match(out, /<form class="gallery-filter-reset"/);
  assert.match(out, /<button[^>]*data-gallery-clear[^>]*>Clear filters<\/button>/);
  assert.doesNotMatch(out, /<button[^>]*hidden/);
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
