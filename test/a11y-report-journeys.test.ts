import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CASES, JOURNEYS, THEMES, buildA11yReport, journeyThemes } from "../scripts/test-a11y.ts";

test("the journeys the report names are the journeys the gate runs, in plain words", () => {
  assert.deepEqual([...JOURNEYS], [
    "open the navigation",
    "search the site",
    "change the language",
    "copy a code block",
    "ask your agent",
    "read without JavaScript",
  ]);
});

test("a keyboard journey runs in both chosen themes; no-JavaScript reports only the system scheme", () => {
  for (const name of JOURNEYS) {
    const themes = journeyThemes(name);
    if (name === "read without JavaScript") {
      assert.deepEqual([...themes], ["system"], "the no-JavaScript page chooses no theme, so no light or dark row is claimed");
    } else {
      assert.deepEqual([...themes], [...THEMES]);
    }
  }
});

test("each journey is reported only in the themes it runs in, with its result", () => {
  const journeys = JOURNEYS.flatMap((name) => journeyThemes(name).map((theme) => ({ name, theme, result: "pass" as const })));
  const report = buildA11yReport({
    commit: "de29199",
    tools: { node: "v24.0.0", playwright: "1.65.0", axe: "4.14.0", chromium: "140.0.0" },
    cases: CASES.slice(0, 1),
    themes: THEMES,
    findings: [],
    known: [],
    journeys,
  }) as {
    journeys: { name: string; theme: string; result: string }[];
    summary: { journeys: Record<string, number> };
  };
  assert.equal(report.journeys.length, 11);
  assert.deepEqual(report.summary.journeys, { pass: 11, fail: 0, skip: 0 });
  assert.deepEqual(
    report.journeys.filter((journey) => journey.name === "read without JavaScript").map((journey) => journey.theme),
    ["system"],
  );
  for (const name of JOURNEYS.filter((item) => item !== "read without JavaScript")) {
    assert.deepEqual(
      report.journeys.filter((journey) => journey.name === name).map((journey) => journey.theme),
      ["dark", "light"],
      name,
    );
  }
});

test("the journeys never click: a control is focused and activated with Enter or Space", () => {
  const source = readFileSync(new URL("../scripts/test-a11y.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function runJourney");
  const end = source.indexOf("/** Every journey in the themes it actually runs in");
  assert.ok(start !== -1 && end > start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /\.click\(/, "a pointer click is not keyboard activation");
  assert.doesNotMatch(block, /\.fill\(/, "typing goes through the keyboard");
  for (const key of ["Enter", "Space", "Escape"]) assert.match(block, new RegExp(`keyboard\\.press\\(\"${key}\\"\\)`));
  assert.match(block, /focusControl\(/);
  assert.match(block, /expectFocus\(/);
});
