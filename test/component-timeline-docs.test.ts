// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS, directive } from "../components/timeline/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/timeline.md");

/** The option names in the first column of the table under `## <heading>`. */
function documented(heading: string): string[] {
  const section = page.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
  const names: string[] = [];
  for (const line of section.split("\n")) {
    const cell = /^\| `([^`]+)` \|/.exec(line);
    if (cell) names.push(cell[1]!);
  }
  return names;
}

test("the page documents exactly the options the timeline reads", () => {
  assert.equal(directive, "timeline");
  assert.deepEqual(documented("Options").sort(), [...OPTIONS].sort());
});

test("the page is a live timeline and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^layout: doc$/m);
  assert.match(page, /^permalink: \/components\/timeline\/$/m);
  assert.match(page, /^::timeline\{/m);
  assert.match(page, /## Without JavaScript/);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/timeline\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/timeline\//);
});
