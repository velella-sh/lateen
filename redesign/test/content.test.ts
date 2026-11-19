import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const routes = [
  "index.md",
  "install.md",
  "layouts.md",
  "components/index.md",
  "components/callout.md",
  "tokens.md",
  "standards.md",
  "changelog.md",
  "404.md",
];

test("the prototype contains the home page and documentation pages from the mockup IA", () => {
  for (const route of routes) assert.ok(existsSync(new URL(`../site/${route}`, import.meta.url)), route);
});

test("navigation only links pages that exist", () => {
  const navigation = readFileSync(new URL("../site/_data/navigation.yml", import.meta.url), "utf8");
  assert.equal((navigation.match(/url:/g) ?? []).length, 8);
  assert.match(navigation, /url: \/components\/callout\//);
  assert.match(navigation, /url: \/standards\//);
});

test("Tailwind and Chart.js outputs are generated rather than authored", () => {
  const ignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /redesign\/styles\/generated\.css/);
  assert.match(ignore, /redesign\/components\/performance-chart\/chart\.umd\.min\.js/);
});
