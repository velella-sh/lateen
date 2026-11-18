import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/layouts/api-reference.md");
const layouts = read("site/layouts.md");
const navigation = read("site/_data/navigation.yml");
const recipe = read("recipes/api-reference.md");

test("the API reference page is a docs page in the navigation and the layout table", () => {
  assert.match(page, /^---\ntitle: API reference\n/);
  assert.match(page, /layout: doc/);
  assert.match(page, /permalink: \/layouts\/api-reference\//);
  assert.match(navigation, /- title: API reference\n\s+url: \/layouts\/api-reference\//);
  assert.match(layouts, /\[API reference layout\]\(\/layouts\/api-reference\/\)/);
});

test("the page documents the layouts, the configuration, and the no-JavaScript rule", () => {
  for (const layout of ["api-reference", "api-reference-index"]) assert.ok(page.includes(`\`${layout}\``), layout);
  for (const option of ["apiReference.source", "apiReference.path", "source: openapi.yaml", "path: /reference/"]) {
    assert.ok(page.includes(option), option);
  }
  assert.match(page, /without client JavaScript/);
  assert.match(page, /fallback/);
});

test("the page names every operation front matter field the layout reads", () => {
  const fields = [
    "apiReference.kind",
    "apiReference.operation.id",
    "apiReference.operation.method",
    "apiReference.operation.path",
    "apiReference.operation.url",
    "apiReference.operation.title",
    "apiReference.operation.description",
    "apiReference.operation.tags",
    "apiReference.operation.deprecated",
    "apiReference.operation.server",
    "apiReference.operation.parameters",
    "apiReference.operation.requestBody",
    "apiReference.operation.responses",
    "name",
    "in",
    "required",
    "deprecated",
    "description",
    "schema",
    "examples",
    "type",
    "format",
    "enum",
    "default",
    "properties",
    "items",
    "additionalProperties",
    "summary",
    "value",
    "content",
    "status",
  ];
  for (const field of fields) assert.ok(page.includes(`\`${field}\``), `the page documents ${field}`);
});

test("the page names every index front matter field the layout reads", () => {
  for (const field of [
    "apiReference.kind",
    "apiReference.title",
    "apiReference.version",
    "apiReference.description",
    "apiReference.navigation",
    "children",
    "url",
  ]) {
    assert.ok(page.includes(`\`${field}\``), `the page documents ${field}`);
  }
});

test("the recipe has runnable build, check, and data API commands", () => {
  for (const command of [
    "cp openapi.yaml site/openapi.yaml",
    "npx mizzen build site --out dist",
    "npx mizzen check site",
    "find dist/reference -name index.html",
    "test -f dist/api/v1/openapi.json",
  ]) {
    assert.ok(recipe.includes(command), command);
  }
  assert.ok(recipe.includes("source: openapi.yaml"));
  assert.ok(recipe.includes("path: /reference/"));
});
