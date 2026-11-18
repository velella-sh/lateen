// The docs are what a reader copies, so a documented option must be an option the code reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { REPORT_ISSUE_OPTIONS } from "../chrome/report-issue/index.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/components/report-issue.md");

test("the page documents exactly the report-issue options the code reads", () => {
  const documented = [...page.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented, [...REPORT_ISSUE_OPTIONS]);
});

test("the page explains the link, the trackers and the no-JavaScript behaviour", () => {
  for (const phrase of ["repository", "GitHub", "GitLab", "nothing is sent", "Without JavaScript", "{title}"]) {
    assert.ok(page.includes(phrase), `the page does not mention ${phrase}`);
  }
});

test("the components index and the navigation link the page", () => {
  assert.match(read("site/components/index.md"), /\(\.\/report-issue\/\)/);
  assert.match(read("site/_data/navigation.yml"), /\/components\/report-issue\//);
});
