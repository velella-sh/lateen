import assert from "node:assert/strict";
import test from "node:test";
import { scale } from "../components/timeline/scale.ts";

/** Positions are percentages, so compare with a tolerance rather than exact floats. */
function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);
}

test("one row rounds out to its whole years", () => {
  const axis = scale([{ start: "2020-01-01", end: "2023-12-31" }]);

  assert.ok(axis);
  assert.equal(axis.unit, "year");
  assert.equal(axis.from, "2020-01-01");
  assert.equal(axis.to, "2024-01-01");
  assert.deepEqual(
    axis.ticks.map((tick) => tick.date),
    ["2020-01-01", "2021-01-01", "2022-01-01", "2023-01-01"],
  );
  // 2020 is a leap year, so its share of the four-year axis is more than a quarter.
  close(axis.ticks[1]?.position ?? NaN, (366 / 1461) * 100);
  close(axis.ticks[2]?.position ?? NaN, (731 / 1461) * 100);
  close(axis.ticks[3]?.position ?? NaN, (1096 / 1461) * 100);
  assert.equal(axis.segments.length, 1);
  close(axis.segments[0]?.start ?? NaN, 0);
  close(axis.segments[0]?.length ?? NaN, 100);
});

test("many rows span the first to the last date", () => {
  const axis = scale([
    { start: "2010-03-01", end: "2010-06-01" },
    { start: "2012-01-01", end: "2014-01-01" },
  ]);

  assert.ok(axis);
  assert.equal(axis.unit, "year");
  assert.equal(axis.from, "2010-01-01");
  assert.equal(axis.to, "2015-01-01");
  assert.deepEqual(
    axis.ticks.map((tick) => tick.date),
    ["2010-01-01", "2011-01-01", "2012-01-01", "2013-01-01", "2014-01-01"],
  );
  close(axis.ticks[1]?.position ?? NaN, (365 / 1826) * 100);
  close(axis.segments[0]?.start ?? NaN, (59 / 1826) * 100);
  close(axis.segments[0]?.length ?? NaN, (93 / 1826) * 100);
  close(axis.segments[1]?.start ?? NaN, (730 / 1826) * 100);
  close(axis.segments[1]?.length ?? NaN, (732 / 1826) * 100);
});

test("a range under two years counts quarters", () => {
  const axis = scale([{ start: "2020-02-10", end: "2020-05-20" }]);

  assert.ok(axis);
  assert.equal(axis.unit, "quarter");
  assert.equal(axis.from, "2020-01-01");
  assert.equal(axis.to, "2020-07-01");
  assert.deepEqual(
    axis.ticks.map((tick) => tick.date),
    ["2020-01-01", "2020-04-01"],
  );
  close(axis.ticks[1]?.position ?? NaN, 50);
  close(axis.segments[0]?.start ?? NaN, (40 / 182) * 100);
  close(axis.segments[0]?.length ?? NaN, (101 / 182) * 100);
});

test("a range over twenty years ticks every year", () => {
  const axis = scale([{ start: "1999-06-15", end: "2026-01-15" }]);

  assert.ok(axis);
  assert.equal(axis.unit, "year");
  assert.equal(axis.from, "1999-01-01");
  assert.equal(axis.to, "2027-01-01");
  assert.equal(axis.ticks.length, 28);
  assert.equal(axis.ticks.at(-1)?.date, "2026-01-01");
  assert.ok((axis.ticks.at(-1)?.position ?? 100) < 100);
  assert.ok((axis.segments[0]?.length ?? 0) > 94);
});

test("explicit bounds widen the axis and round out the same way", () => {
  const axis = scale([{ start: "2012-05-01", end: "2012-06-01" }], { from: "2010-03-15", to: "2014-08-20" });

  assert.ok(axis);
  assert.equal(axis.unit, "year");
  assert.equal(axis.from, "2010-01-01");
  assert.equal(axis.to, "2015-01-01");
  assert.equal(axis.ticks.length, 5);
  assert.ok((axis.segments[0]?.start ?? 0) > 40);

  const shared = scale([], { from: "2020-02-10", to: "2020-08-20" });

  assert.ok(shared);
  assert.equal(shared.unit, "quarter");
  assert.equal(shared.from, "2020-01-01");
  assert.equal(shared.to, "2020-10-01");
  assert.equal(shared.ticks.length, 3);
  assert.deepEqual(shared.segments, []);
});

test("an invalid or absent date is left out of the bounds and gets no segment", () => {
  const axis = scale([
    { start: "2020-02-30", end: "not a date" },
    { start: "2020-01-10", end: "2020-03-10" },
  ]);

  assert.ok(axis);
  assert.equal(axis.from, "2020-01-01");
  assert.equal(axis.to, "2020-04-01");
  assert.equal(axis.unit, "quarter");
  assert.equal(axis.segments[0], undefined);
  close(axis.segments[1]?.start ?? NaN, (9 / 91) * 100);
  close(axis.segments[1]?.length ?? NaN, (61 / 91) * 100);

  assert.equal(scale([{ start: "", end: "2020-02-30" }, {}]), undefined);
  assert.equal(scale([]), undefined);
});
