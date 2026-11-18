import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GALLERY_OPTIONS } from "../layouts/gallery.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/gallery.md");

/** The backticked option names in the first column of every table row. */
function documented(): string[] {
  return [...page.matchAll(/^\| `([a-z][a-zA-Z.]*)` \|/gm)].map((match) => match[1] ?? "");
}

test("the page documents exactly the options the gallery reads", () => {
  assert.deepEqual(documented().sort(), [...GALLERY_OPTIONS].sort());
});

test("the page is a live gallery and explains the no-JavaScript view", () => {
  assert.match(page, /^layout: gallery$/m);
  assert.match(page, /^list:\n  collection: books$/m);
  assert.match(page, /Without JavaScript/);
  assert.match(page, /\?filter\.format=hardcover/);
  assert.match(page, /\?sort=published&order=desc/);
});

test("the gallery page is reachable from the components index, the layout table and the navigation", () => {
  assert.match(read("site/components/index.md"), /\[Gallery layout\]\(\.\/gallery\/\)/);
  assert.match(read("site/layouts.md"), /\[Gallery layout\]\(\/components\/gallery\/\)/);
  assert.match(read("site/_data/navigation.yml"), /url: \/components\/gallery\//);
});
