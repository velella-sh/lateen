import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { archive, verifyArchive } from "../scripts/archive-reports.ts";
import { root } from "./integration-helpers.ts";

const MIZZEN = join(root, "node_modules/@velella/mizzen/bin/mizzen.js");

/** Builds one site folder with this checkout's theme into `out`, and returns the output folder. */
function buildSite(site: string, out: string): string {
  const run = spawnSync(process.execPath, [MIZZEN, "build", site, "--theme", ".", "--out", out], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(`mizzen build failed:\n${run.stderr || run.stdout || run.error?.message || "no output"}`);
  return out;
}

/** A copy of `site/` without the build cache, so the test can archive into it and build it. */
function copySite(destination: string): string {
  const site = join(destination, "site");
  cpSync(join(root, "site"), site, {
    recursive: true,
    filter: (path) => !path.split(sep).includes(".mizzen"),
  });
  return site;
}

function text(doc: Document): string {
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

test("a 0.3.0 archive renders both stored reports and replaces the empty-state row", () => {
  const work = mkdtempSync(join(tmpdir(), "lateen-release-e2e-"));
  try {
    const site = copySite(work);
    const example = JSON.parse(readFileSync(join(site, "_data/report-example.json"), "utf8")) as {
      accessibility: Record<string, unknown>;
      performance: Record<string, unknown>;
    };
    const a11y = join(work, "a11y.json");
    const performance = join(work, "performance.json");
    writeFileSync(a11y, JSON.stringify(example.accessibility));
    writeFileSync(performance, JSON.stringify(example.performance));

    archive("0.3.0", a11y, performance, work);

    assert.deepEqual(verifyArchive(join(site, "_data/reports")), []);
    const page = readFileSync(join(site, "reports.md"), "utf8");
    assert.match(page, /\| \[0\.3\.0\]\(\/reports\/0\.3\.0\/\)/);
    assert.doesNotMatch(page, /No release is stored yet/);
    assert.doesNotMatch(page, /Nothing is stored yet/);

    const out = buildSite(site, join(work, "out"));
    const release = new JSDOM(readFileSync(join(out, "reports/0.3.0/index.html"), "utf8")).window.document;
    assert.ok(release.querySelector(".a11y-report .a11y-report-table"), "the archived accessibility report rendered");
    assert.ok(release.querySelector(".budget-report .budget-report-table"), "the archived performance report rendered");
    assert.equal(release.querySelector(".report-missing"), null, "no report is missing on the release page");
    assert.match(text(release), /Accessibility report/);
    assert.match(text(release), /Performance report/);
    assert.equal(release.querySelector(".a11y-report-commit a")?.getAttribute("href"), "https://github.com/velella-sh/lateen/commit/0123456");

    const index = new JSDOM(readFileSync(join(out, "reports/index.html"), "utf8")).window.document;
    assert.equal(index.querySelector("a[href='/reports/0.3.0/']")?.textContent?.trim(), "0.3.0");
    assert.doesNotMatch(text(index), /No release is stored yet/);

    assert.throws(() => archive("0.3.0", a11y, performance, work), /already stored/);

    writeFileSync(join(site, "_data/reports/0.3.0/a11y.json"), JSON.stringify({ ...example.accessibility, edited: true }));
    assert.match(verifyArchive(join(site, "_data/reports")).join("\n"), /a11y\.json: the file changed after it was archived/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
