import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOLERANCE_BYTES, buildPerformanceReport, type Budget, type Measurements } from "../scripts/performance-budget.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/performance-report.schema.json", import.meta.url), "utf8")) as JsonSchema;

const measurement = (raw: number, gzip: number, count = 1) => ({ raw, gzip, count });

const measured: Measurements = {
  "/guide/": {
    "css/base": measurement(1000, 300),
    "css/page": measurement(500, 150),
    "js/chrome": measurement(2000, 700, 2),
    "js/components": measurement(0, 0, 0),
    "js/inline": measurement(400, 180),
    "font/self-hosted": { ...measurement(5000, 2500, 2), assets: [] },
  },
  "/": {
    "css/base": measurement(1000, 300),
    "css/page": measurement(0, 0, 0),
    "js/chrome": measurement(2000, 700, 2),
    "js/components": measurement(0, 0, 0),
    "js/inline": measurement(300, 120),
    "font/self-hosted": { ...measurement(5000, 2500, 2), assets: [] },
  },
};

const budget: Budget = {
  routes: {
    "/": {
      "css/base": measurement(1000, 300),
      "css/page": measurement(0, 0, 0),
      "js/chrome": measurement(2000, 700, 2),
      "js/components": measurement(0, 0, 0),
      "js/inline": measurement(300, 120),
      "font/self-hosted": { ...measurement(5000, 2500, 2), assets: [] },
    },
  },
};

test("the report satisfies schema/performance-report.schema.json and carries no clock", () => {
  const report = buildPerformanceReport(measured, budget, "de29199");
  assert.deepEqual(validate(schema, report), []);
  assert.equal(JSON.stringify(report).includes("generatedAt"), false);
});

test("routes and classes are ordered stably, whatever order the measurement arrived in", () => {
  const report = buildPerformanceReport(measured, budget, "de29199") as {
    routes: { route: string; classes: { name: string }[] }[];
    tolerance: number;
  };
  assert.deepEqual(report.routes.map((route) => route.route), ["/", "/guide/"]);
  assert.deepEqual(report.routes[0]?.classes.map((item) => item.name), [
    "css/base",
    "css/page",
    "js/chrome",
    "js/components",
    "js/inline",
    "font/self-hosted",
  ]);
  assert.equal(report.tolerance, TOLERANCE_BYTES);
  const reversed = buildPerformanceReport(Object.fromEntries(Object.entries(measured).reverse()), budget, "de29199");
  assert.equal(JSON.stringify(reversed), JSON.stringify(buildPerformanceReport(measured, budget, "de29199")));
});

test("a class keeps its checked-in budget only when the budget has that route", () => {
  const report = buildPerformanceReport(measured, budget, "de29199") as {
    routes: { route: string; classes: { name: string; budget?: { gzip: number; count: number } }[] }[];
  };
  assert.deepEqual(report.routes[0]?.classes[0]?.budget, { gzip: 300, count: 1 });
  assert.equal(report.routes[1]?.classes[0]?.budget, undefined);
  const none = buildPerformanceReport(measured, undefined, "de29199") as { routes: { classes: { budget?: unknown }[] }[] };
  assert.ok(none.routes.every((route) => route.classes.every((item) => item.budget === undefined)));
});

test("the totals add JavaScript and CSS per route, and only those", () => {
  const report = buildPerformanceReport(measured, budget, "de29199") as {
    totals: { route: string; javascript: { raw: number; gzip: number }; css: { raw: number; gzip: number } }[];
  };
  assert.deepEqual(report.totals, [
    { route: "/", javascript: { raw: 2300, gzip: 820 }, css: { raw: 1000, gzip: 300 } },
    { route: "/guide/", javascript: { raw: 2400, gzip: 880 }, css: { raw: 1500, gzip: 450 } },
  ]);
});
