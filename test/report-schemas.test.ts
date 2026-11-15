import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const a11ySchema = read("../schema/a11y-report.schema.json") as JsonSchema;
const performanceSchema = read("../schema/performance-report.schema.json") as JsonSchema;
const wcagSchema = read("../schema/wcag-checks.schema.json") as JsonSchema;
const wcag = parse(readFileSync(new URL("../site/_data/wcag.yml", import.meta.url), "utf8")) as {
  criteria: { id: string; principle: string; level: string; how: string; checked?: { evidence: string } }[];
};

/** The WCAG 2.2 level A and AA success criteria, so a missing or extra row fails here. */
const CRITERIA: readonly (readonly [string, string])[] = [
  ["1.1.1", "A"],
  ["1.2.1", "A"],
  ["1.2.2", "A"],
  ["1.2.3", "A"],
  ["1.2.4", "AA"],
  ["1.2.5", "AA"],
  ["1.3.1", "A"],
  ["1.3.2", "A"],
  ["1.3.3", "A"],
  ["1.3.4", "AA"],
  ["1.3.5", "AA"],
  ["1.4.1", "A"],
  ["1.4.2", "A"],
  ["1.4.3", "AA"],
  ["1.4.4", "AA"],
  ["1.4.5", "AA"],
  ["1.4.10", "AA"],
  ["1.4.11", "AA"],
  ["1.4.12", "AA"],
  ["1.4.13", "AA"],
  ["2.1.1", "A"],
  ["2.1.2", "A"],
  ["2.1.4", "A"],
  ["2.2.1", "A"],
  ["2.2.2", "A"],
  ["2.3.1", "A"],
  ["2.4.1", "A"],
  ["2.4.2", "A"],
  ["2.4.3", "A"],
  ["2.4.4", "A"],
  ["2.4.5", "AA"],
  ["2.4.6", "AA"],
  ["2.4.7", "AA"],
  ["2.4.11", "AA"],
  ["2.5.1", "A"],
  ["2.5.2", "A"],
  ["2.5.3", "A"],
  ["2.5.4", "A"],
  ["2.5.7", "AA"],
  ["2.5.8", "AA"],
  ["3.1.1", "A"],
  ["3.1.2", "AA"],
  ["3.2.1", "A"],
  ["3.2.2", "A"],
  ["3.2.3", "AA"],
  ["3.2.4", "AA"],
  ["3.2.6", "A"],
  ["3.3.1", "A"],
  ["3.3.2", "A"],
  ["3.3.3", "AA"],
  ["3.3.4", "AA"],
  ["3.3.7", "A"],
  ["3.3.8", "AA"],
  ["4.1.2", "A"],
  ["4.1.3", "AA"],
];

/** One accessibility report with every field filled, as the gate writes it. */
function a11ySample(): Record<string, unknown> {
  return {
    tool: "lateen/a11y-report",
    version: 1,
    commit: "de29199",
    tools: { node: "v24.0.0", playwright: "1.65.0", axe: "4.14.0", chromium: "140.0.0" },
    rules: ["wcag2a", "wcag2aa"],
    matrix: [
      { case: "docs document", site: "docs", path: "/lateen/install/", layout: "doc", lang: "en", theme: "light", width: 1280, height: 900 },
    ],
    findings: [
      {
        case: "docs document",
        theme: "dark",
        rule: "color-contrast",
        impact: "moderate",
        target: ".example",
        help: "Contrast",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
      },
    ],
    known: [{ case: "docs document", theme: "light", rule: "region", target: "main" }],
    journeys: [
      { name: "search", theme: "light", result: "pass" },
      { name: "read without JavaScript", theme: "system", result: "pass" },
    ],
    summary: { states: 2, findings: { minor: 0, moderate: 1, serious: 0, critical: 0 }, journeys: { pass: 2, fail: 0, skip: 0 } },
  };
}

/** One performance report with every field filled, as the budget writes it. */
function performanceSample(): Record<string, unknown> {
  return {
    tool: "lateen/performance-report",
    version: 1,
    commit: "de29199",
    tolerance: 64,
    routes: [
      {
        route: "/",
        classes: [
          { name: "css/base", raw: 1000, gzip: 300, count: 1, budget: { gzip: 310, count: 1 } },
          { name: "js/chrome", raw: 2000, gzip: 700, count: 2 },
        ],
      },
    ],
    totals: [{ route: "/", javascript: { raw: 2000, gzip: 700 }, css: { raw: 1000, gzip: 300 } }],
  };
}

test("the reader accepts a report that satisfies each schema", () => {
  assert.deepEqual(validate(a11ySchema, a11ySample()), []);
  assert.deepEqual(validate(performanceSchema, performanceSample()), []);
  assert.deepEqual(validate(wcagSchema, wcag), []);
});

test("the reader rejects a missing field, a wrong enum, and an undocumented field", () => {
  const missing = a11ySample();
  delete missing.commit;
  assert.match(validate(a11ySchema, missing).join("\n"), /commit is missing/);

  const wrong = performanceSample();
  (wrong.routes as { classes: { name: string }[] }[])[0]!.classes[0]!.name = "html";
  assert.match(validate(performanceSchema, wrong).join("\n"), /not one of/);

  const extra = a11ySample();
  extra.generatedAt = "2026-11-15T10:00:00Z";
  assert.match(validate(a11ySchema, extra).join("\n"), /generatedAt is not a documented field/);
});

test("the reader reports an unsupported schema keyword instead of passing it", () => {
  assert.match(validate({ oneOf: [] } as unknown as JsonSchema, "x").join("\n"), /unsupported keyword "oneOf"/);
});

test("the checklist covers every WCAG 2.2 A and AA criterion once, at its own level and principle", () => {
  assert.deepEqual(
    wcag.criteria.map((item) => [item.id, item.level]),
    CRITERIA,
  );
  for (const item of wcag.criteria) {
    assert.equal(item.principle, { 1: "perceivable", 2: "operable", 3: "understandable", 4: "robust" }[item.id[0] as "1"], item.id);
  }
});

test("a manual check is recorded only with its evidence", () => {
  for (const item of wcag.criteria) {
    if (item.checked !== undefined) assert.match(item.checked.evidence, /^https:\/\//, item.id);
    assert.ok(["automated", "manual", "not-applicable"].includes(item.how), item.id);
  }
});
