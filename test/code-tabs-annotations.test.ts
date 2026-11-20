import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build } from "./integration-helpers.ts";

test("each code tab keeps the annotations of the example it shows", () => {
  const site = build("integration", process.env);
  try {
    const doc = new JSDOM(site.html("/annotated-tabs/")).window.document;
    const panels = [...doc.querySelectorAll(".code-tabs-panel")];

    assert.equal(panels.length, 2);
    for (const [index, text] of ["The npm example", "The pnpm example"].entries()) {
      const panel = panels[index];
      assert.equal(panel?.querySelector("details.code-annotations") !== null, true);
      assert.match(panel?.querySelector(".code-tabs-body")?.textContent ?? "", new RegExp(text));
      const other = index === 0 ? "The pnpm example" : "The npm example";
      assert.doesNotMatch(panel?.textContent ?? "", new RegExp(other));
    }
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
});
