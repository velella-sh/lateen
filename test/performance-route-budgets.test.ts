import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOLERANCE_BYTES,
  compare,
  type Budget,
  type Measurements,
  type RouteMeasurement,
} from "../scripts/performance-budget.ts";

const ARTICLE = "/article/";
const DATA = "/data/";

const measurement = (gzip: number) => ({ raw: gzip * 2, gzip, count: 1 });

/** A route that ships only the shared base stylesheet and its own page stylesheet. */
const route = (base: number, page: number): RouteMeasurement =>
  ({ "css/base": measurement(base), "css/page": measurement(page) }) as RouteMeasurement;

const budget: Budget = {
  routes: {
    [ARTICLE]: route(1000, 500),
    [DATA]: route(2000, 400),
  },
};

test("growth on the data route fails that route alone", () => {
  const measured: Measurements = {
    [ARTICLE]: route(1000, 500),
    [DATA]: route(7000, 400),
  };
  assert.deepEqual(compare(measured, budget), [
    `route /data/: css/base is 7000 B gzip, the baseline is 2000 B (limit ${2000 + TOLERANCE_BYTES} B)`,
  ]);
});

test("growth on the article route fails that route alone", () => {
  const measured: Measurements = {
    [ARTICLE]: route(1000, 3500),
    [DATA]: route(2000, 400),
  };
  assert.deepEqual(compare(measured, budget), [
    `route /article/: css/page is 3500 B gzip, the baseline is 500 B (limit ${500 + TOLERANCE_BYTES} B)`,
  ]);
});

test("a data route's growth cannot change the article verdict", () => {
  const measured: Measurements = { [ARTICLE]: route(1000, 500) };
  assert.deepEqual(compare(measured, budget), [
    "route /data/: it is in the budget, but the fixture no longer builds it",
  ]);
});

test("separation still reports a missing budget route and an unbudgeted route", () => {
  const measured: Measurements = {
    [DATA]: route(2000, 400),
    "/news/": route(300, 100),
  };
  assert.deepEqual(compare(measured, budget), [
    "route /article/: it is in the budget, but the fixture no longer builds it",
    "route /news/: it is not in the budget; run `node scripts/performance-budget.ts --update`",
  ]);
});
