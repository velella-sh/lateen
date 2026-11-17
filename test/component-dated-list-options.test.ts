import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import datedList, { GROUP_CLASS, TOC_CLASS, YEAR_CLASS } from "../components/dated-list/index.ts";

/** Rows that cross three Gregorian years, with two rows in one month so order shows inside a group. */
const items = [
  { date: "2024-12-31", label: "Old year" },
  { date: "2025-01-15", label: "Early" },
  { date: "2025-11-09", label: "Late" },
  { date: "2025-11-12", label: "Latest" },
  { date: "2026-03-20", label: "Spring" },
];

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props: { items, ...props }, page: { ...page, lang }, html: "" } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

/** Every heading, its level, its id, and its text, in document order. */
const headings = (html: string): { level: number; id: string; text: string }[] =>
  [...html.matchAll(/<h([2-6])(?: id="([^"]*)")?>([^<]*)<\/h\1>/g)].map((match) => ({
    level: Number(match[1]),
    id: match[2] ?? "",
    text: match[3] ?? "",
  }));

const datetimes = (html: string): string[] =>
  [...html.matchAll(/<time class="dated-list-day" datetime="([^"]*)"/g)].map((match) => match[1] ?? "");

const tocLinks = (html: string): string[] =>
  [...html.matchAll(/<a href="#([^"]*)">([^<]*)<\/a>/g)].map((match) => match[1] ?? "");

test("the default order is oldest first, and every month heading is an h2", () => {
  const out = render({});
  assert.deepEqual(
    headings(out).map((heading) => heading.text),
    ["December 2024", "January 2025", "November 2025", "March 2026"],
  );
  for (const heading of headings(out)) {
    assert.equal(heading.level, 2);
    assert.equal(heading.id, "", "no anchor unless the page asks for a table of contents");
  }
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 4);
});

test("order=desc puts the newest month and the newest day of a month first", () => {
  const out = render({ order: "desc" });
  assert.deepEqual(
    headings(out).map((heading) => heading.text),
    ["March 2026", "November 2025", "January 2025", "December 2024"],
  );
  assert.deepEqual(datetimes(out), ["2026-03-20", "2025-11-12", "2025-11-09", "2025-01-15", "2024-12-31"]);
});

test("group=year adds a year heading one level above its months", () => {
  const out = render({ group: "year" });
  assert.deepEqual(
    headings(out).map((heading) => [heading.level, heading.text]),
    [
      [2, "2024"],
      [3, "December 2024"],
      [2, "2025"],
      [3, "January 2025"],
      [3, "November 2025"],
      [2, "2026"],
      [3, "March 2026"],
    ],
  );
  assert.equal((out.match(new RegExp(YEAR_CLASS, "g")) ?? []).length, 3);
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 4);
  assert.match(out, new RegExp(`<section class="${YEAR_CLASS}"><h2>2025</h2><section`));
});

test("group=year groups by the page's calendar year, not the ISO year", () => {
  const persian = [
    { date: "2025-03-01", label: "Esfand" },
    { date: "2025-12-01", label: "Azar" },
    { date: "2026-03-20", label: "Nowruz eve" },
  ];
  const out = render({ group: "year", items: persian }, "fa");
  assert.deepEqual(
    headings(out).map((heading) => [heading.level, heading.text]),
    [
      [2, "۱۴۰۳"],
      [3, "۱۴۰۳ اسفند"],
      [2, "۱۴۰۴"],
      [3, "۱۴۰۴ آذر"],
      [3, "۱۴۰۴ اسفند"],
    ],
  );
  assert.equal((out.match(new RegExp(YEAR_CLASS, "g")) ?? []).length, 2, "one group per calendar year");
});

test("level moves the whole outline one step and never skips a level", () => {
  assert.deepEqual(
    headings(render({ level: 3 })).map((heading) => heading.level),
    [3, 3, 3, 3],
  );
  assert.deepEqual(
    headings(render({ group: "year", level: 3 })).map((heading) => heading.level),
    [3, 4, 3, 4, 4, 3, 4],
  );
  // With years, h6 months would need an h7 year, so the level falls back to the default.
  assert.deepEqual(
    headings(render({ group: "year", level: 6 })).map((heading) => heading.level),
    [2, 3, 2, 3, 3, 2, 3],
  );
  // h1 would repeat the page title, and a non-integer level is not a heading.
  assert.deepEqual(
    headings(render({ level: 1 })).map((heading) => heading.level),
    [2, 2, 2, 2],
  );
  assert.deepEqual(
    headings(render({ level: "2.5" })).map((heading) => heading.level),
    [2, 2, 2, 2],
  );
});

test("toc is off by default and lists the groups, in order, when the page asks", () => {
  assert.doesNotMatch(render({}), new RegExp(TOC_CLASS));
  const flat = render({ toc: true });
  assert.match(flat, new RegExp(`<nav class="${TOC_CLASS}" aria-label="On this page">`));
  assert.deepEqual(tocLinks(flat), headings(flat).map((heading) => heading.id));
  const group = render({ toc: "true", group: "year" });
  assert.deepEqual(tocLinks(group), [
    "dated-list-2024",
    "dated-list-12-2024",
    "dated-list-2025",
    "dated-list-1-2025",
    "dated-list-11-2025",
    "dated-list-2026",
    "dated-list-3-2026",
  ]);
  assert.deepEqual(headings(group).map((heading) => heading.id), tocLinks(group));
  assert.equal([...group.matchAll(new RegExp(TOC_CLASS, "g"))].length, 1);
  assert.ok(group.indexOf(`class="${TOC_CLASS}"`) < group.indexOf(`class="${YEAR_CLASS}"`), "the toc comes first");
  assert.equal(render({ toc: false }).includes(TOC_CLASS), false);
});
