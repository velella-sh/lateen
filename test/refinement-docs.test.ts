// The refinement page names tokens; every one of them must exist in the token files (#478), so the
// page cannot describe a token that is not there.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DENSITIES, RADII } from "../src/brand.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../site/refinement.md");
const tokensCss = read("../styles/tokens.css");

test("every token the refinement page names is defined in the generated token file", () => {
  const named = [...new Set([...page.matchAll(/`(--[a-z0-9-]+)`/g)].map((m) => m[1] ?? ""))];
  assert.ok(named.length >= 20, "the page should list the refinement tokens");
  const defined = new Set([...tokensCss.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  assert.deepEqual(named.filter((name) => !defined.has(name)), []);
});

test("the page is linked from the Customize section of the navigation", () => {
  const nav = read("../site/_data/navigation.yml");
  assert.match(nav, /title: Refinement\n\s+url: \/refinement\//);
});

test("the radius and density options the page explains are the ones the brand module accepts", () => {
  for (const word of [...RADII, ...DENSITIES]) {
    assert.match(page, new RegExp(`\`${word}\``), `${word} is documented`);
  }
});
