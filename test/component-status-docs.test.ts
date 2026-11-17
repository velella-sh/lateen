// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/status/index.ts";
import { OPTIONS as LEGEND_OPTIONS } from "../components/status-legend/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/status.md");

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

test("the page documents exactly the status options the code reads", () => {
  assert.deepEqual(documented("Status options").sort(), [...OPTIONS].sort());
  assert.deepEqual(documented("Status legend options").sort(), [...LEGEND_OPTIONS].sort());
});

test("the page has a live example and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^::status\[/m);
  assert.match(page, /^::status\{value=/m);
  assert.match(page, /^::status-legend$/m);
  assert.match(page, /^::status-legend\{values=/m);
  assert.match(page, /## Without JavaScript/);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/status\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/status\//);
});
