// The docs are what a reader copies, so a documented input must be one the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/add-to-calendar/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/add-to-calendar.md");

test("the page documents exactly the add-to-calendar inputs the code reads", () => {
  const documented = [...page.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...OPTIONS]);
});

test("the page has a live example and explains the no-JavaScript behaviour", () => {
  assert.match(page, /\]\(\/books\/alpha\/\)/);
  assert.match(page, /^## Without JavaScript$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/add-to-calendar\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/add-to-calendar\//);
});
