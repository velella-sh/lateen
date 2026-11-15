// The docs are what a reader copies, so a documented option must be an option the code reads. The
// brand page lists every path from src/brand.ts, the preset page shows every shipped preset, and the
// component page lists exactly the props the component exports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../components/preset-preview/index.ts";
import { BRAND_OPTION_PATHS, presetNames } from "../src/brand.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The first column of every table row, as plain text. */
function firstColumn(markdown: string): string[] {
  return [...markdown.matchAll(/^\|([^|]+)\|/gm)].map((match) => (match[1] ?? "").trim());
}

/** The backticked option path in a table cell, or `undefined` when the row names none. */
function optionPath(cell: string): string | undefined {
  return /^`(theme\.options[^`]*)`$/.exec(cell)?.[1];
}

test("the brand page documents every option path the code reads", () => {
  const documented = firstColumn(read("site/brand-options.md"))
    .map(optionPath)
    .filter((path): path is string => path !== undefined);
  assert.deepEqual([...documented].sort(), [...BRAND_OPTION_PATHS].sort());
});

test("the component page lists every option the component exports", () => {
  const documented = firstColumn(read("site/components/preset-preview.md"))
    .map((cell) => /^`([a-z]+)`$/.exec(cell)?.[1])
    .filter((name): name is string => name !== undefined);
  assert.deepEqual(documented.sort(), [...OPTIONS].sort());
});

test("the preset page shows every shipped preset", () => {
  const page = read("site/presets.md");
  const shown = [...page.matchAll(/::preset-preview\{preset=([a-z0-9-]+)/g)].map((match) => match[1] ?? "");
  assert.deepEqual(shown.sort(), presetNames());
  for (const name of presetNames()) assert.match(page, new RegExp(`^## .+`, "m"), `the ${name} preview has a heading`);
});

test("the new pages are reachable from the site navigation and the components index", () => {
  const navigation = read("site/_data/navigation.yml");
  for (const url of ["/brand-options/", "/presets/"]) assert.ok(navigation.includes(url), url);
  assert.match(read("site/components/index.md"), /\[Preset preview\]\(\.\/preset-preview\/\)/);
  assert.match(read("site/tokens.md"), /\[Brand options\]\(\/brand-options\/\)/);
});
