import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PAGE_LIMIT, PROMPT_URL_LIMIT, TEXT_LIMIT } from "../chrome/ask-agent/prompt.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../site/ask-agent.md");
const design = read("../docs/design/ask-agent.md");
const navigation = read("../site/_data/navigation.yml");

test("the ask-agent page is a docs page in the navigation", () => {
  assert.match(page, /^---\ntitle: Ask your agent\n/);
  assert.match(page, /layout: doc/);
  assert.match(page, /permalink: \/ask-agent\//);
  assert.match(navigation, /- title: Ask your agent\n\s+url: \/ask-agent\//);
});

test("the page documents the limits the prompt code enforces", () => {
  assert.ok(page.includes(`| ${PAGE_LIMIT} |`), "the related-page limit is documented");
  assert.ok(page.includes(TEXT_LIMIT.toLocaleString("en-US")), "the text limit is documented");
  assert.ok(page.includes(PROMPT_URL_LIMIT.toLocaleString("en-US")), "the link limit is documented");
});

test("the page documents only options the code reads", () => {
  assert.match(page, /theme\.options\.pageAgent\.providers/);
  assert.ok(page.includes("{prompt}"));
  for (const placeholder of ["{url}", "{title}", "{lang}", "{source}", "{version}"]) {
    assert.equal(
      page.includes(placeholder),
      false,
      `${placeholder} belongs to the page menu, not the ask panel`,
    );
  }
});

test("the page and the design note state the privacy rule", () => {
  for (const text of [page, design]) {
    assert.match(text, /site (itself )?sends nothing/i);
    assert.match(text, /no (AI|hosted) service|no server answers/i);
  }
});
