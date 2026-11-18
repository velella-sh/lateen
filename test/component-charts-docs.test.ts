// The docs are what a reader copies, so a documented option must be an option the chart code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS as BAR_OPTIONS } from "../components/bar-chart/index.ts";
import { OPTIONS as LINE_OPTIONS } from "../components/line-chart/index.ts";
import { OPTIONS as STACKED_OPTIONS } from "../components/stacked-bar/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/charts.md");

/** The option names in the first column of the table under a `## <heading>` section. */
function documented(heading: string): string[] {
  const section = page.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
  const names: string[] = [];
  for (const line of section.split("\n")) {
    const cell = /^\| `([^`]+)` \|/.exec(line);
    if (cell) names.push(cell[1]!);
  }
  return names;
}

test("the page documents exactly the options the chart units read", () => {
  assert.deepEqual(documented("Bar chart options").sort(), [...BAR_OPTIONS].sort());
  assert.deepEqual(documented("Stacked bar options").sort(), [...STACKED_OPTIONS].sort());
  assert.deepEqual(documented("Line chart options").sort(), [...LINE_OPTIONS].sort());
});

test("the page has a live example of each chart and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^::bar-chart\{/m);
  assert.match(page, /^::stacked-bar\{/m);
  assert.match(page, /^::line-chart\{/m);
  assert.match(page, /## The data table/);
  assert.match(page, /## Without JavaScript/);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/charts\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/charts\//);
});
