import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "./integration-helpers.ts";

test("Mizzen 0.2.5 publishes page totals without identifying individual test outcomes", () => {
  const site = build("page-tools", process.env, {
    "example-results.md": [
      "---\ntitle: Example results\n---",
      "```js test\nconsole.log('hello');\n```",
      "```js test\nthrow new Error('expected failure');\n```",
      "```python test\nprint('not run');\n```",
    ].join("\n\n"),
  });
  const page = site.document("/example-results/");
  const ids = [...page.querySelectorAll("[data-example-id]")].map((code) => code.getAttribute("data-example-id"));
  assert.equal(new Set(ids).size, 3, "the rendered fences have distinct identities");
  const report = JSON.parse(site.file("examples.json")) as {
    pages: { url: string; total: number; passed: number; failed: number; skipped: number }[];
  };
  const totals = report.pages.find(({ url }) => url === "/example-results/");
  assert.ok(totals);
  assert.deepEqual(Object.keys(totals), ["url", "total", "passed", "failed", "skipped"]);
  assert.equal(totals.total, 3);
  assert.equal(totals.skipped, 1);
  assert.equal(totals.passed + totals.failed, 2);
  assert.equal(page.querySelector(".tested-chip"), null, "page totals cannot identify which block passed");
});
