import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { CASES, THEMES } from "../scripts/test-a11y.ts";
import { root } from "./integration-helpers.ts";

const MIZZEN = join(root, "node_modules/@velella/mizzen/bin/mizzen.js");

/** The report page in each language and the language and direction it must render in. */
const PAGES = [
  { path: "/reports/", lang: "en", dir: "ltr", heading: "Accessibility report" },
  { path: "/fa/reports/", lang: "fa", dir: "rtl", heading: "گزارش دسترس‌پذیری" },
  { path: "/ar/reports/", lang: "ar", dir: "rtl", heading: "تقرير إمكانية الوصول" },
] as const;

/** The HTML file a route writes under the built output. */
const outputFile = (path: string): string => join(path.slice(1), path.endsWith("/") ? "index.html" : "");

function text(doc: Document): string {
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

test("English, Persian, and Arabic report pages render all three components in both themes", () => {
  const work = mkdtempSync(join(tmpdir(), "lateen-report-pages-"));
  try {
    const source = join(work, "site");
    cpSync(join(root, "test/accessibility/fixtures/site"), source, {
      recursive: true,
      filter: (path) => !path.split(sep).includes(".mizzen"),
    });
    const out = join(work, "out");
    const run = spawnSync(process.execPath, [MIZZEN, "build", source, "--theme", ".", "--out", out], { cwd: root, encoding: "utf8" });
    if (run.status !== 0) throw new Error(`mizzen build failed:\n${run.stderr || run.stdout || run.error?.message || "no output"}`);

    for (const page of PAGES) {
      const doc = new JSDOM(readFileSync(join(out, outputFile(page.path)), "utf8")).window.document;
      assert.equal(doc.documentElement.getAttribute("lang"), page.lang, page.path);
      assert.equal(doc.documentElement.getAttribute("dir"), page.dir, page.path);
      assert.ok(doc.querySelector(".a11y-report .a11y-report-table"), `a11y-report on ${page.path}`);
      assert.ok(doc.querySelector(".budget-report .budget-report-table"), `budget-report on ${page.path}`);
      assert.ok(doc.querySelector(".wcag-checklist .wcag-checklist-table"), `wcag-checklist on ${page.path}`);
      assert.equal(doc.querySelector(".report-missing"), null, `no missing report on ${page.path}`);
      assert.match(text(doc), new RegExp(page.heading), page.path);
      assert.ok(doc.querySelectorAll(".wcag-checklist-table tbody tr").length >= 55, `every criterion on ${page.path}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("the accessibility matrix keeps the report page in every language, audited in both themes", () => {
  for (const page of PAGES) {
    const found = CASES.filter((item) => item.path === page.path);
    assert.equal(found.length, 1, `${page.path} is one matrix case`);
    assert.equal(found[0]?.lang, page.lang, `${page.path} audits ${page.lang}`);
    assert.equal(found[0]?.layout, "doc");
  }
  assert.deepEqual([...THEMES], ["light", "dark"], "each report page is audited in both themes");
});
