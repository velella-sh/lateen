// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TERM_OPTIONS } from "../components/term/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/glossary.md");

test("the page documents exactly the term options the code reads", () => {
  const section = page.slice(page.indexOf("## Options"), page.indexOf("## Theme options"));
  const documented = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...TERM_OPTIONS]);
});

test("the page documents the theme options the component reads", () => {
  for (const option of ["glossary.collection", "glossary.page"]) {
    assert.ok(page.includes(`\`${option}\``), `the page does not document ${option}`);
  }
  assert.match(page, /page#id/);
  assert.match(page, /base path/);
});

test("the page has a live list, inline terms, and a no-JavaScript section", () => {
  assert.match(page, /^::glossary$/m);
  assert.match(page, /:term\[Latency\]\{id=latency\}/);
  assert.match(page, /^## Without JavaScript$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/glossary\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/glossary\//);
});
