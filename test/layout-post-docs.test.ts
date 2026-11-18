import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = read("site/layouts/post.md");
const index = read("site/layouts.md");
const navigation = read("site/_data/navigation.yml");
const recipe = read("recipes/blog.md");

test("the blog layout page is a docs page linked from the layout index", () => {
  assert.match(page, /^---[\s\S]*?layout: doc[\s\S]*?permalink: \/layouts\/post\/[\s\S]*?---/);
  assert.match(index, /\| `post` \|[^\n]*\[Blog layout\]\(\/layouts\/post\/\)/);
  assert.match(navigation, /- title: Blog layout\s*\n\s*url: \/layouts\/post\//);
});

test("the docs name the config, post front matter, and public routes", () => {
  for (const fact of ["blog:", "posts:", "route:", "archive:", "authors:", "feed:", "date:", "author:", "draft: true"]) {
    assert.ok(page.includes(fact), `the blog docs do not mention ${fact}`);
  }
  for (const route of ["/blog/<slug>/", "/blog/archive/", "/blog/authors/<id>/", "/blog/feed.xml"]) {
    assert.ok(page.includes(route), `the blog docs do not name ${route}`);
  }
  assert.match(page, /_data\/authors\.yml/);
  assert.match(page, /newest first/i);
});

test("the recipe has runnable setup commands and the same config keys", () => {
  assert.match(recipe, /npm install @velella\/mizzen @velella\/lateen/);
  assert.match(recipe, /npx mizzen build site/);
  assert.match(recipe, /npx mizzen check site --theme \./);
  assert.match(recipe, /blog:\s*\n\s*posts: posts/);
  assert.match(recipe, /_data\/authors\.yml/);
  assert.match(recipe, /draft: true/);
});
