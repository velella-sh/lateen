// The docs are what a reader copies, so a documented input must be one the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/term/index.ts";
import { GLOSSARY_OPTION_PATHS } from "../src/terms.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/glossary.md");

/** The first column of every table row between `heading` and the next heading. */
function tableUnder(heading: string): string[] {
  const start = page.indexOf(heading);
  assert.notEqual(start, -1, `the page has no ${heading} section`);
  const rest = page.slice(start + heading.length);
  const end = rest.search(/^## /m);
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1] ?? "");
}

test("the page documents exactly the term option and the glossary theme options", () => {
  assert.deepEqual(tableUnder("## Options"), [...OPTIONS]);
  assert.deepEqual(tableUnder("## Theme options"), [...GLOSSARY_OPTION_PATHS]);
});

test("the page has a live example and explains the no-JavaScript behaviour", () => {
  assert.match(page, /^::glossary$/m);
  assert.match(page, /:term\[Widget\]/);
  assert.match(page, /^## Without JavaScript$/m);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/glossary\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/glossary\//);
});

test("the docs site reads the collection the page and the theme options name", () => {
  const config = read("site/mizzen.yml");
  assert.match(config, /^    glossary:\n      collection: glossary$/m);
  assert.match(config, /^  glossary:\n    source: _data\/glossary\.yml$/m);
  assert.match(read("site/_data/glossary.yml"), /^  term: Widget$/m);
});
