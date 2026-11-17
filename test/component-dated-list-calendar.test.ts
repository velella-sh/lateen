import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import datedList, { GROUP_CLASS } from "../components/dated-list/index.ts";

/** The same records on every page; each pair straddles a month boundary in a non-Gregorian calendar. */
const items = [
  { date: "2026-03-20", label: "Spring eve" },
  { date: "2026-03-21", label: "New year" },
  { date: "2026-05-16", label: "Mid May" },
  { date: "2026-05-17", label: "Late May" },
];

const page = { lang: "en", url: "/dates/", frontMatter: {} } as unknown as Page;

function render(lang: string): string {
  const input = { props: { items }, page: { ...page, lang }, html: "" } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

const headings = (html: string): string[] =>
  [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((match) => match[1] ?? "");

const datetimes = (html: string): string[] =>
  [...html.matchAll(/<time class="dated-list-day" datetime="([^"]*)"/g)].map((match) => match[1] ?? "");

/** Each month section's ISO dates, in order. */
const groups = (html: string): string[][] =>
  [...html.matchAll(new RegExp(`<section class="${GROUP_CLASS}"><h2>[^<]*</h2><ol[^>]*>([\\s\\S]*?)</ol>`, "g"))].map(
    (match) => datetimes(match[1] ?? ""),
  );

test("an English page groups the records by Gregorian months", () => {
  const out = render("en");
  assert.deepEqual(headings(out), ["March 2026", "May 2026"]);
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 2);
});

test("a Persian page groups the same records by Jalali months, in Persian digits", () => {
  const out = render("fa");
  assert.deepEqual(headings(out), ["۱۴۰۴ اسفند", "۱۴۰۵ فروردین", "۱۴۰۵ اردیبهشت"]);
  assert.doesNotMatch(headings(out).join(" "), /[0-9]/, "Latin digits in a Persian heading");
  assert.match(out, /<time class="dated-list-day" datetime="2026-03-21">۱<\/time>/);
});

test("an Arabic page groups the same records by Hijri months, in Arabic-Indic digits", () => {
  const out = render("ar");
  assert.deepEqual(headings(out), ["شوال ١٤٤٧ هـ", "ذو القعدة ١٤٤٧ هـ", "ذو الحجة ١٤٤٧ هـ"]);
  assert.doesNotMatch(headings(out).join(" "), /[0-9]/, "Latin digits in an Arabic heading");
});

test("a month boundary inside one Gregorian month starts a new group in the page's calendar", () => {
  // 2026-03-20 and 2026-03-21 are both March, but the Jalali year turns at 2026-03-21.
  // 2026-05-16 and 2026-05-17 are both May, but the Hijri month turns at 2026-05-17.
  assert.deepEqual(groups(render("en")), [
    ["2026-03-20", "2026-03-21"],
    ["2026-05-16", "2026-05-17"],
  ]);
  assert.deepEqual(groups(render("fa")), [["2026-03-20"], ["2026-03-21"], ["2026-05-16", "2026-05-17"]]);
  assert.deepEqual(groups(render("ar")), [["2026-03-20", "2026-03-21"], ["2026-05-16"], ["2026-05-17"]]);
});

test("every datetime attribute stays an ISO 8601 date, whatever the display calendar", () => {
  for (const lang of ["en", "fa", "ar"]) {
    const values = datetimes(render(lang));
    assert.deepEqual(values, ["2026-03-20", "2026-03-21", "2026-05-16", "2026-05-17"], lang);
    for (const value of values) assert.match(value, /^\d{4}-\d{2}-\d{2}$/, lang);
  }
});
