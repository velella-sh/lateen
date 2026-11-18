// The docs are what a reader copies, so every fence meta the component renders is written there.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/code.md");

test("the code page documents every fence meta the theme renders", () => {
  for (const meta of ['title="', "showLineNumbers", "ins={", "del={", "diff", "annotations={", "{1,3-5}"]) {
    assert.ok(page.includes(meta), `${meta} is documented`);
  }
});

test("the page has a live annotated fence and no stale 'not rendered' note", () => {
  assert.match(page, /```ts title="answer\.ts" \{3\} showLineNumbers annotations=\{/);
  assert.doesNotMatch(page, /does not render it/);
});

test("the recipe builds the docs site and checks the disclosure", () => {
  const recipe = read("recipes/code-annotations.md");
  assert.match(recipe, /mizzen build site --theme \./);
  assert.match(recipe, /code-annotations/);
  assert.match(recipe, /index\.md/);
});
