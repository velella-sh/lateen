// The axis stays on Gregorian ISO dates, but its ticks sit on the year and quarter boundaries of the
// page's calendar and its labels use that calendar's years and digits: English, Persian, Arabic.
import assert from "node:assert/strict";
import { test } from "node:test";
import { scale } from "../components/timeline/scale.ts";
import { tickLabel } from "../components/timeline/index.ts";

const rows = [{ start: "2020-01-01", end: "2023-06-30" }];

const labelled = (start: string, end: string, lang: string): { readonly date: string; readonly label: string; readonly unit: string }[] => {
  const scaled = scale([{ start, end }], {}, lang);
  assert.ok(scaled);
  return scaled.ticks.map((tick) => ({ date: tick.date, label: tickLabel(tick.date, scaled.unit, lang), unit: scaled.unit }));
};

test("a year axis ticks on each calendar's new year, over the same rows", () => {
  assert.deepEqual(labelled("2020-01-01", "2023-06-30", "en").map((tick) => [tick.date, tick.label]), [
    ["2020-01-01", "2020"],
    ["2021-01-01", "2021"],
    ["2022-01-01", "2022"],
    ["2023-01-01", "2023"],
  ]);

  assert.deepEqual(labelled("2020-01-01", "2023-06-30", "fa").map((tick) => [tick.date, tick.label]), [
    ["2020-03-20", "۱۳۹۹"],
    ["2021-03-21", "۱۴۰۰"],
    ["2022-03-21", "۱۴۰۱"],
    ["2023-03-21", "۱۴۰۲"],
  ]);

  assert.deepEqual(labelled("2020-01-01", "2023-06-30", "ar").map((tick) => [tick.date, tick.label]), [
    ["2020-08-20", "١٤٤٢ هـ"],
    ["2021-08-09", "١٤٤٣ هـ"],
    ["2022-07-29", "١٤٤٤ هـ"],
    ["2023-07-18", "١٤٤٥ هـ"],
  ]);
});

test("a quarter axis ticks on each calendar's quarter starts, in its digits", () => {
  assert.deepEqual(labelled("2026-01-01", "2026-10-01", "en").map((tick) => [tick.date, tick.label, tick.unit]), [
    ["2026-01-01", "2026 Q1", "quarter"],
    ["2026-04-01", "2026 Q2", "quarter"],
    ["2026-07-01", "2026 Q3", "quarter"],
    ["2026-10-01", "2026 Q4", "quarter"],
  ]);

  assert.deepEqual(labelled("2026-01-01", "2026-10-01", "fa").map((tick) => [tick.date, tick.label]), [
    ["2026-03-21", "۱۴۰۵ Q۱"],
    ["2026-06-22", "۱۴۰۵ Q۲"],
    ["2026-09-23", "۱۴۰۵ Q۳"],
    ["2026-12-22", "۱۴۰۵ Q۴"],
  ]);

  const arabic = labelled("2026-01-01", "2026-10-01", "ar");
  assert.deepEqual(arabic.map((tick) => tick.date), ["2026-03-20", "2026-06-16", "2026-09-12", "2026-12-10"]);
  assert.deepEqual(arabic.map((tick) => tick.label), ["١٤٤٧ هـ Q4", "١٤٤٨ هـ Q1", "١٤٤٨ هـ Q2", "١٤٤٨ هـ Q3"]);
});

test("the axis bounds, segments and datetime values stay Gregorian ISO", () => {
  const en = scale(rows, {}, "en");
  const fa = scale(rows, {}, "fa");
  assert.ok(en && fa);

  for (const scaled of [en, fa]) {
    assert.match(scaled.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(scaled.to, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(scaled.from, "2020-01-01");
    assert.equal(scaled.to, "2024-01-01");
  }
  assert.deepEqual(fa.segments, en.segments, "the same rows keep their places whatever the labels say");
  assert.ok(fa.ticks.every((tick) => /^\d{4}-\d{2}-\d{2}$/.test(tick.date)));
});

test("explicit bounds still round out before the calendar labels are drawn", () => {
  const scaled = scale([{ start: "2021-02-01", end: "2021-03-01" }], { from: "2020-06-01", to: "2022-02-01" }, "fa");
  assert.ok(scaled);
  assert.equal(scaled.from, "2020-04-01");
  assert.equal(scaled.to, "2022-04-01");
  assert.deepEqual(scaled.ticks.map((tick) => tick.date), [
    "2020-06-21",
    "2020-09-22",
    "2020-12-21",
    "2021-03-21",
    "2021-06-22",
    "2021-09-23",
    "2021-12-22",
    "2022-03-21",
  ]);
});
