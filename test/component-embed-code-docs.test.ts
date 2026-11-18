// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/embed-code/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/embed-code.md");

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

test("the page documents exactly the embed code options the code reads", () => {
  assert.deepEqual(documented("Options").sort(), [...OPTIONS].sort());
});

test("the page has a live example that names a built embedded page", () => {
  assert.match(page, /^::embed-code\{src=/m);
  assert.match(page, /## Without JavaScript/);
  assert.match(read("site/embed-example.md"), /^layout: embedded$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/embed-code\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/embed-code\//);
});
