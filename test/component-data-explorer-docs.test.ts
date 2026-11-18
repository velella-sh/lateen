import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/data-explorer/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/data-explorer.md");

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

test("the page documents exactly the options the component reads", () => {
  assert.deepEqual(documented("Options").sort(), [...OPTIONS].sort());
});

test("the page shows a live example and explains the no-JavaScript behaviour", () => {
  assert.match(page, /::data-explorer\{from=books/);
  assert.match(page, /^## Without JavaScript$/m);
  assert.match(page, /search results page/);
  assert.match(page, /parameter names/);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/data-explorer\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/data-explorer\//);
});
