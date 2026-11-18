// The guide layout is documented on a page the layout itself renders, so the example is the page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FACTS } from "../components/guide-summary/index.ts";
import { STATUSES } from "../components/page-status/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/guide.md");

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

test("the page documents exactly the guide facts the summary reads", () => {
  assert.deepEqual(documented("Guide facts").sort(), [...FACTS].sort());
});

test("the page documents the page front matter the layout reads", () => {
  assert.deepEqual(documented("Page front matter").sort(), [
    "order",
    "replaced_by",
    "since",
    "status",
    "tags",
    "title",
  ]);
  for (const status of STATUSES) {
    assert.ok(page.includes(`\`${status}\``), `the page does not name the ${status} status`);
  }
});

test("the page is a live guide and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^layout: guide$/m);
  assert.match(page, /^guide:$/m);
  assert.match(page, /^:::steps$/m);
  assert.match(page, /^:::before-after$/m);
  assert.match(page, /^:::trap$/m);
  assert.match(page, /^:::check-list$/m);
  assert.match(page, /## Without JavaScript/);
});

test("the components index, the layouts index, and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/guide\/\)/);
  assert.match(read("site/layouts.md"), /\/components\/guide\//);
  assert.match(read("site/_data/navigation.yml"), /\/components\/guide\//);
});
