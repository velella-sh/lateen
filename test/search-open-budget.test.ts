import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validate, type JsonSchema } from "../src/report-schema.ts";
import { baselineOf, median, searchVerdict, type SearchReport } from "../scripts/search-open-budget.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/search-open-report.schema.json", import.meta.url), "utf8")) as JsonSchema;

function report(firstMs: number, repeatMs: number, baseline = { firstMs: 2000, repeatMs: 1000 }): SearchReport {
  return { tool: "lateen/search-open-report", version: 1, commit: "de29199", viewport: "mobile", firstMs, repeatMs, baseline, ok: true };
}

test("the median of an odd or even list is a whole millisecond", () => {
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([11, 12]), 12);
  assert.throws(() => median([]), /at least one value/);
});

test("a baseline rounds each measurement up to the next 100 ms", () => {
  assert.deepEqual(baselineOf({ firstMs: 1234, repeatMs: 1001 }), { firstMs: 1300, repeatMs: 1100 });
  assert.deepEqual(baselineOf({ firstMs: 1200, repeatMs: 0 }), { firstMs: 1200, repeatMs: 0 });
});

test("a report inside both ceilings passes", () => {
  assert.deepEqual(searchVerdict(report(2000, 1000)), []);
  assert.deepEqual(searchVerdict(report(10, 20, { firstMs: 0, repeatMs: 0 })), [
    "first opening 10 ms is over the 0 ms baseline",
    "repeat opening 20 ms is over the 0 ms baseline",
  ]);
});

test("a report over either ceiling fails with the opening it names", () => {
  assert.deepEqual(searchVerdict(report(2100, 900)), ["first opening 2100 ms is over the 2000 ms baseline"]);
  assert.deepEqual(searchVerdict(report(1900, 1100)), ["repeat opening 1100 ms is over the 1000 ms baseline"]);
});

test("the schema accepts a report the budget writes", () => {
  assert.deepEqual(validate(schema, report(1200, 500)), []);
});
