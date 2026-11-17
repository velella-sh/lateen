import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import datedList, { EMPTY_CLASS, GROUP_CLASS, OUTSIDE_CLASS } from "../components/dated-list/index.ts";

/** Rows on both sides of a range, with one month in the range left empty. */
const items = [
  { date: "2024-11-20", label: "Before" },
  { date: "2025-01-15", label: "January" },
  { date: "2025-03-05", label: "March" },
  { date: "2025-06-01", label: "After" },
];

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props: { items, ...props }, page: { ...page, lang }, html: "" } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

const headings = (html: string): string[] =>
  [...html.matchAll(/<h[2-6](?: id="[^"]*")?>([^<]*)<\/h[2-6]>/g)].map((match) => match[1] ?? "");

const datetimes = (html: string): string[] =>
  [...html.matchAll(/<time class="dated-list-day" datetime="([^"]*)"/g)].map((match) => match[1] ?? "");

test("a range lists every month, including an empty one", () => {
  const out = render({ start: "2025-01-01", months: 3 });
  assert.deepEqual(headings(out), ["January 2025", "February 2025", "March 2025"]);
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 3);
  assert.match(out, new RegExp(`<p class="dated-list-note ${EMPTY_CLASS}">Nothing this month\\.</p>`));
  assert.deepEqual(datetimes(out), ["2025-01-15", "2025-03-05"]);
});

test("the empty month's note is translated", () => {
  const out = render({ start: "2025-01-01", months: 2 }, "fa");
  assert.match(out, new RegExp(`class="dated-list-note ${EMPTY_CLASS}">این ماه رکوردی ندارد\\.`));
});

test("records outside the range are left out and counted", () => {
  const out = render({ start: "2025-01-01", months: 1 });
  assert.deepEqual(headings(out), ["January 2025"]);
  assert.deepEqual(datetimes(out), ["2025-01-15"]);
  assert.doesNotMatch(out, /Before|March|After/);
  assert.match(out, new RegExp(`<p class="dated-list-note ${OUTSIDE_CLASS}">Records outside this range: 3\\.</p>`));
});

test("without start only months with records are listed", () => {
  const out = render({ months: 3 });
  assert.deepEqual(headings(out), ["November 2024", "January 2025", "March 2025", "June 2025"]);
  assert.equal((out.match(new RegExp(EMPTY_CLASS, "g")) ?? []).length, 0);
  assert.equal((out.match(new RegExp(OUTSIDE_CLASS, "g")) ?? []).length, 0);
  assert.deepEqual(datetimes(out), ["2024-11-20", "2025-01-15", "2025-03-05", "2025-06-01"]);

  assert.deepEqual(headings(render({ start: "2025-01-01" })), headings(out), "months alone does not make a range");
});

test("group=year keeps a year heading over an empty month", () => {
  const out = render({ start: "2024-12-01", months: 3, group: "year" });
  assert.deepEqual(headings(out), ["2024", "December 2024", "2025", "January 2025", "February 2025"]);
});

test("order=desc reverses the range and its rows", () => {
  const out = render({ start: "2024-12-01", months: 4, order: "desc" });
  assert.deepEqual(headings(out), ["March 2025", "February 2025", "January 2025", "December 2024"]);
  assert.deepEqual(datetimes(out), ["2025-03-05", "2025-01-15"]);
});
