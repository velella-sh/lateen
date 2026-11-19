// A 0.2.2 site must keep the pages it had when it upgrades. `fixtures/upgrade-0.2.2-expected` is
// the HTML the v0.2.2 tag wrote for `fixtures/upgrade-0.2.2`; this test builds that site with this
// checkout and compares the documents.
//
// Asset file hashes are the only difference ignored everywhere; code blocks are compared by text
// because the highlighter's token spans depend on the engine's grammar version. Every other intended
// difference is listed with its reason, and the test fails on a difference the list does not name.
// The stored output is evidence: do not regenerate it to make this test pass.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build, root } from "./integration-helpers.ts";

const FIXTURE = "upgrade-0.2.2";
const EXPECTED = join(root, "fixtures", `${FIXTURE}-expected`);

/** A difference this release makes on purpose, removed from both documents before comparing. */
const INTENDED = [
  { selector: ".doc-actions", reason: "0.2.3 adds the page actions, copy-Markdown and agent menu to every doc layout." },
  { selector: ".source-mode-switch", reason: "Source mode is new in 0.2.3." },
  { selector: ".ask-agent", reason: "The ask-your-agent panel is new in 0.2.3." },
  { selector: ".steps", reason: "Steps number each item and keep a progress state in 0.2.3." },
  { selector: ".output-block", reason: "Output blocks share the code highlighter's markup in 0.2.3." },
  { selector: ".terminal", reason: "Terminal bodies share the code block markup in 0.2.3." },
  { selector: ".shortcut", reason: "The shortcut list gained the source-mode key in 0.2.3." },
  { selector: "script", reason: "The theme script set grows with the new islands and their data." },
] as const;

/** Every HTML file a build wrote, as paths relative to its output folder. */
function pages(dir: string): string[] {
  const found: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(join(dir, path), { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".html")) found.push(next);
    }
  };
  walk(".");
  return found.sort();
}

/** The document with asset hashes and highlighter token spans removed, and every intended difference taken out. */
function normalize(text: string): { head: string; body: string } {
  const unhased = text
    // `base-d4840993c99ad705.css` and `geist-…-de174d9fdfca3f7d.woff2`.
    .replace(/-[0-9a-f]{16}\.(css|js|woff2)/g, "-HASH.$1")
    // 0.2.2 leaked a `div` where the kbd directive should be; 0.2.3 renders the key. This is the
    // one difference that is a fix in place, so it is reduced to its text on both sides.
    .replace(/Press (?:<div>|<kbd class="kbd">)Ctrl\+K(?:<\/div>|<\/kbd>) to search/g, "Press Ctrl+K to search");
  const dom = new JSDOM(unhased);
  const document = dom.window.document;
  for (const difference of INTENDED) {
    for (const element of [...document.querySelectorAll(difference.selector)]) element.remove();
  }
  for (const element of [...document.querySelectorAll("[data-search-ask-heading]")]) {
    for (const name of ["data-search-ask-heading", "data-search-ask-label", "data-search-ask-hint"]) {
      element.removeAttribute(name);
    }
  }
  // A fence's token spans are the highlighter's presentation of the same text, and the engine's
  // grammar version can change them. Keep the block, its attributes, and its text; drop the spans.
  for (const block of [...document.querySelectorAll("pre.code")]) block.textContent = block.textContent;
  return { head: document.head.innerHTML, body: document.body.innerHTML };
}

/** The first place two strings differ, with enough context for the failure message. */
function firstDifference(expected: string, actual: string): string {
  let index = 0;
  while (index < expected.length && expected[index] === actual[index]) index += 1;
  const window = (text: string): string => JSON.stringify(text.slice(Math.max(0, index - 60), index + 200));
  return `at ${index}\n  stored 0.2.2: ${window(expected)}\n  this build:   ${window(actual)}`;
}

test("a 0.2.2 site renders the same pages on this version", () => {
  const site = build(FIXTURE);
  const expected = pages(EXPECTED);
  assert.deepEqual(pages(site.out), expected, "the 0.2.3 build writes the 0.2.2 page set");

  for (const page of expected) {
    const stored = normalize(readFileSync(join(EXPECTED, page), "utf8"));
    const current = normalize(site.html(`/${page}`));
    assert.equal(current.head, stored.head, `${page} head\n${firstDifference(stored.head, current.head)}`);
    assert.equal(current.body, stored.body, `${page} body\n${firstDifference(stored.body, current.body)}`);
  }
});

test("every intended difference names a reason", () => {
  for (const difference of INTENDED) {
    assert.ok(difference.reason.trim() !== "", `${difference.selector} explains why the page changed`);
    assert.ok(difference.selector.trim() !== "");
  }
  assert.ok(INTENDED.length > 0, "the reviewed difference list is not empty");
});
