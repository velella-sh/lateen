import assert from "node:assert/strict";
import { test } from "node:test";
import { CASES, JOURNEYS, THEMES, buildA11yReport } from "../scripts/test-a11y.ts";

test("the journeys the report names are the journeys the gate runs, in plain words", () => {
  assert.deepEqual([...JOURNEYS], [
    "open the navigation",
    "search the site",
    "change the language",
    "copy a code block",
    "read without JavaScript",
  ]);
});

test("each journey is reported in both themes, with its result", () => {
  const journeys = JOURNEYS.flatMap((name) =>
    THEMES.map((theme) => ({ name, theme, result: name === "copy a code block" ? ("fail" as const) : ("pass" as const) })),
  );
  const report = buildA11yReport({
    commit: "de29199",
    tools: { node: "v24.0.0", playwright: "1.65.0", axe: "4.14.0", chromium: "140.0.0" },
    cases: CASES.slice(0, 1),
    themes: THEMES,
    findings: [],
    known: [],
    journeys,
  }) as { journeys: { name: string; theme: string; result: string }[]; summary: { journeys: Record<string, number> } };
  assert.equal(report.journeys.length, JOURNEYS.length * THEMES.length);
  assert.deepEqual(report.summary.journeys, { pass: 8, fail: 2, skip: 0 });
});
