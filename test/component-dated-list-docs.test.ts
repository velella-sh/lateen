// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DATED_LIST_OPTIONS } from "../components/dated-list/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/dated-list.md");

test("the page documents exactly the dated-list options the code reads", () => {
  const documented = [...page.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...DATED_LIST_OPTIONS]);
});

test("the page has a live example and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^::dated-list\{/m);
  assert.match(page, /^## Without JavaScript$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/dated-list\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/dated-list\//);
});
