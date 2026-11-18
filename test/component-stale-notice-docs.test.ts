// The docs are what a reader copies, so a documented option must be one the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/stale-notice/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/stale-notice.md");

test("the page documents exactly the stale-notice options the code reads", () => {
  const documented = [...page.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...OPTIONS]);
});

test("the page names the review lock and explains the no-JavaScript behaviour", () => {
  assert.match(page, /docs-review\.lock\.json/);
  assert.match(page, /^## Without JavaScript$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/stale-notice\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/stale-notice\//);
});
