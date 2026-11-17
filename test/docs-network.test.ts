import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NETWORK_OPTION_PATHS } from "../src/options.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/network.md");

/** The option paths in the first column of the page's tables, in page order. */
function documented(): string[] {
  const names: string[] = [];
  let inTable = false;
  for (const line of page.split("\n")) {
    if (/^\| Option \|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const cell = /^\| `([^`]+)` \|/.exec(line);
    if (cell) names.push(cell[1]!);
    else if (!/^\| ---/.test(line)) inTable = false;
  }
  return names;
}

test("the page documents exactly the network options the code reads", () => {
  assert.deepEqual(documented().sort(), [...NETWORK_OPTION_PATHS].sort());
});

test("the page explains the no-JavaScript behaviour and uses generic project names", () => {
  assert.match(page, /## Without JavaScript/);
  assert.match(page, /<details>/);
  assert.match(page, /scope=project/);
  assert.match(page, /scope=all/);
  for (const name of ["Alpha", "Beta Docs", "Gamma"]) assert.match(page, new RegExp(name));
  assert.doesNotMatch(page, /https?:\/\/(?!example\.com)/);
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/network\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/network\//);
});
