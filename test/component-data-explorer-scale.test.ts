// The explorer keeps its per-keystroke match inside a time budget on a large collection: the loaded
// index is normalized once, and each query only compares precomputed words. The numbers below are
// deliberately generous for a shared CI runner; the measured local figure is in docs/design.
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRows, prepareRows } from "../components/data-explorer/match.ts";

const COUNT = 10_000;

/** A keystroke may spend this long matching before the table stops feeling instant. */
const KEYSTROKE_BUDGET_MS = 50;

/** The load may spend this long normalizing the whole index once. */
const LOAD_BUDGET_MS = 500;

const columns = ["title", "author", "shelf", "year"];

const index = {
  collection: "books",
  columns,
  rows: Array.from({ length: COUNT }, (_, i) => [
    `Book ${i}`,
    `Author ${i % 50}`,
    `Shelf ${i % 7}`,
    String(2000 + (i % 25)),
  ]),
};

const elapsed = (run: () => void): number => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

/** The fastest of a few runs: a scheduler or GC pause under a loaded runner hits one run, a real slowdown hits all. */
const best = (run: () => void, runs = 5): number => Math.min(...Array.from({ length: runs }, () => elapsed(run)));

test("a 10,000-row index is prepared inside the load budget", () => {
  let prepared;
  const took = best(() => {
    prepared = prepareRows(index, columns);
  }, 3);

  assert.equal(prepared!.length, COUNT);
  assert.ok(took < LOAD_BUDGET_MS, `preparing took ${took.toFixed(1)}ms, budget ${LOAD_BUDGET_MS}ms`);
});

test("each keystroke matches 10,000 rows inside the time budget", () => {
  const prepared = prepareRows(index, columns);
  assert.equal(matchRows(prepared, "").length, COUNT);

  for (const query of ["book", "bo", "book 12", "shelf 3", "author 4", "zz"]) {
    const took = best(() => matchRows(prepared, query));
    assert.ok(took < KEYSTROKE_BUDGET_MS, `"${query}" took ${took.toFixed(1)}ms, budget ${KEYSTROKE_BUDGET_MS}ms`);
  }
});

test("the same query repeated stays inside the budget and keeps its order", () => {
  const prepared = prepareRows(index, columns);
  const first = matchRows(prepared, "book 12").map((row) => row[0]);
  assert.ok(first.length > 0);

  const took = best(() => {
    for (let run = 0; run < 5; run++) assert.deepEqual(matchRows(prepared, "book 12").map((row) => row[0]), first);
  });
  assert.ok(took < KEYSTROKE_BUDGET_MS * 5, `five repeats took ${took.toFixed(1)}ms`);
});
