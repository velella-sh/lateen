// The timeline's date arithmetic, characterized as pure data: date conversion, spans, the axis
// range, phase segments, overlaps and tick labels, including month/year precision, RTL calendar
// labels, missing dates and overlapping phases. No rendering is involved.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAY,
  type Axis,
  dayOf,
  iso,
  overlaps,
  phasesOf,
  rangeOf,
  segmentOf,
  segmentsOf,
  spanOf,
  tickLabel,
} from "../components/timeline/ranges.ts";

const fields = { start: "start", end: "end" };
const row = (values: Record<string, unknown>) => ({ fields: values });

// The first quarter of 2026: 90 days, so one day is 100/90 percent of the axis.
const axis: Axis = { from: Date.parse("2026-01-01"), span: Date.parse("2026-04-01") - Date.parse("2026-01-01") };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("dayOf converts only complete ISO 8601 dates, at UTC midnight", () => {
  assert.equal(dayOf("2026-05-05"), Date.parse("2026-05-05"));
  assert.equal(dayOf(" 2026-05-05 "), Date.parse("2026-05-05"), "surrounding whitespace is trimmed");
  assert.equal(dayOf("2026-05"), undefined, "a month is not a day");
  assert.equal(dayOf("2026"), undefined, "a year is not a day");
  assert.equal(dayOf("2026-02-30"), undefined, "a day the calendar does not have is not a date");
  assert.equal(dayOf("yesterday"), undefined);
  assert.equal(dayOf(42), undefined);
  assert.equal(dayOf(null), undefined);
  assert.equal(dayOf(undefined), undefined);
  assert.equal(iso(Date.parse("2026-05-05")), "2026-05-05", "iso writes the day back");
});

test("spanOf runs a missing end to its start, and ignores a bad date", () => {
  assert.deepEqual(spanOf(row({ start: "2026-01-01", end: "2026-01-10" }), fields), {
    from: Date.parse("2026-01-01"),
    to: Date.parse("2026-01-10"),
  });
  const startOnly = Date.parse("2026-01-01");
  assert.deepEqual(spanOf(row({ start: "2026-01-01" }), fields), { from: startOnly, to: startOnly });
  assert.deepEqual(spanOf(row({ start: "2026-01-01", end: "" }), fields), { from: startOnly, to: startOnly });
  const endOnly = Date.parse("2026-01-10");
  assert.deepEqual(spanOf(row({ end: "2026-01-10" }), fields), { from: endOnly, to: endOnly });
  assert.deepEqual(spanOf(row({ start: "2026-05", end: "2026-01-10" }), fields), { from: endOnly, to: endOnly });
  assert.equal(spanOf(row({}), fields), undefined);
  assert.equal(spanOf(row({ start: "2026", end: "2026-05" }), fields), undefined, "month and year precision draw no bar");
  assert.deepEqual(spanOf(row({ begin: "2026-01-01", finish: "2026-01-10" }), { start: "begin", end: "finish" }), {
    from: Date.parse("2026-01-01"),
    to: Date.parse("2026-01-10"),
  });
});

test("phasesOf reads a list of objects and ignores anything else", () => {
  const phase = { label: "Build", start: "2026-01-01", end: "2026-01-10" };
  assert.deepEqual(phasesOf(row({ phases: [phase, null, 3, "x", [phase], undefined] }), "phases"), [{ fields: phase }]);
  assert.deepEqual(phasesOf(row({ phases: "nope" }), "phases"), []);
  assert.deepEqual(phasesOf(row({ phases: { label: "Build" } }), "phases"), []);
  assert.deepEqual(phasesOf(row({}), "phases"), []);
});

test("rangeOf widens a row to its phases, and is undefined without any real date", () => {
  const main = row({ start: "2026-01-01", end: "2026-01-10" });
  const phases = [row({ start: "2025-12-20", end: "2026-02-01" })];
  assert.deepEqual(rangeOf(main, phases, fields), { start: "2025-12-20", end: "2026-02-01" });
  assert.deepEqual(rangeOf(main, [row({})], fields), { start: "2026-01-01", end: "2026-01-10" });
  assert.deepEqual(rangeOf(row({}), phases, fields), { start: "2025-12-20", end: "2026-02-01" });
  assert.equal(rangeOf(row({}), [row({ start: "2026-05" })], fields), undefined);
});

test("segmentOf places a closed bar, and a one-day row still has a length", () => {
  const segment = segmentOf(row({ start: "2026-01-01", end: "2026-01-10" }), fields, axis);
  assert.ok(segment);
  close(segment.start, 0);
  close(segment.length, (10 * DAY * 100) / axis.span);
  assert.equal(segment.openStart, false);
  assert.equal(segment.openEnd, false);

  const oneDay = segmentOf(row({ start: "2026-01-01", end: "2026-01-01" }), fields, axis);
  assert.ok(oneDay);
  close(oneDay.length, (DAY * 100) / axis.span);

  const middle = segmentOf(row({ start: "2026-02-01", end: "2026-02-01" }), fields, axis);
  assert.ok(middle);
  close(middle.start, (31 * DAY * 100) / axis.span);
  assert.equal(segmentOf(row({}), fields, axis), undefined);
});

test("segmentOf leaves an empty date open to the axis edge, but a missing field is not ongoing", () => {
  const openEnd = segmentOf(row({ start: "2026-01-01", end: "" }), fields, axis);
  assert.ok(openEnd);
  assert.equal(openEnd.openEnd, true);
  assert.equal(openEnd.openStart, false);
  close(openEnd.start, 0);
  close(openEnd.length, 100);

  const openStart = segmentOf(row({ start: "", end: "2026-01-10" }), fields, axis);
  assert.ok(openStart);
  assert.equal(openStart.openStart, true);
  assert.equal(openStart.openEnd, false);
  close(openStart.start, 0);
  close(openStart.length, (10 * DAY * 100) / axis.span);

  const noEndField = segmentOf(row({ start: "2026-01-01" }), fields, axis);
  assert.ok(noEndField);
  assert.equal(noEndField.openEnd, false, "a field the row does not have is a mistake, not an open end");
  close(noEndField.length, (DAY * 100) / axis.span);
});

test("segmentsOf gives each phase its own bar, in order, and none without a real date", () => {
  const phases = [
    row({ start: "2026-01-01", end: "2026-01-10" }),
    row({ label: "no dates" }),
    row({ start: "2026-02-01", end: "2026-02-10" }),
  ];
  const segments = segmentsOf(phases, fields, axis);
  assert.equal(segments.length, 3);
  assert.ok(segments[0] && segments[2]);
  assert.equal(segments[1], undefined);
  close(segments[0].start, 0);
  close(segments[2].start, (31 * DAY * 100) / axis.span);
});

test("overlaps names only phases that share a day, in the order the row lists them", () => {
  const build = row({ label: "Build", start: "2026-01-01", end: "2026-01-10" });
  const adjoining = row({ label: "Review", start: "2026-01-11", end: "2026-01-20" });
  assert.deepEqual(overlaps([build, adjoining], fields), [], "adjoining phases do not overlap");

  const sharing = row({ label: "Review", start: "2026-01-10", end: "2026-01-20" });
  assert.deepEqual(overlaps([build, sharing], fields), [build, sharing], "one shared day is an overlap");

  const gap = row({ label: "Gap", start: "2026-01-12", end: "2026-01-15" });
  const late = row({ label: "Ship", start: "2026-01-05", end: "2026-01-08" });
  assert.deepEqual(overlaps([build, gap, late], fields), [build, late], "the middle phase is not named");

  const undated = row({ label: "Undated" });
  assert.deepEqual(overlaps([undated, build, sharing], fields), [build, sharing], "a phase without dates never overlaps");
  assert.deepEqual(overlaps([build], fields), []);
  assert.deepEqual(overlaps([], fields), []);
  const sameDay = row({ label: "Same", start: "2026-01-01", end: "2026-01-01" });
  assert.deepEqual(overlaps([sameDay, row({ start: "2026-01-01", end: "2026-01-01" })], fields).length, 2);
});

test("tickLabel keeps year and quarter precision in the page calendar's digits", () => {
  assert.equal(tickLabel("2020-01-01", "year", "en"), "2020");
  assert.equal(tickLabel("2026-05-05", "quarter", "en"), "2026 Q2");
  assert.equal(tickLabel("2026-04-01", "quarter", "en"), "2026 Q2");
  assert.equal(tickLabel("2026-12-31", "quarter", "en"), "2026 Q4");
  assert.equal(tickLabel("2020-03-20", "year", "fa"), "۱۳۹۹");
  assert.equal(tickLabel("2026-03-21", "quarter", "fa"), "۱۴۰۵ Q۱");
  assert.equal(tickLabel("2020-08-20", "year", "ar"), "١٤٤٢ هـ");
  assert.equal(tickLabel("2026-03-20", "quarter", "ar"), "١٤٤٧ هـ Q4");
});