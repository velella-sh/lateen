import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";
import { archive, readIndex, tableOf, totalsOf, verifyArchive, type ReleaseEntry } from "../scripts/archive-reports.ts";
import { dataAt } from "../src/report.ts";

const root = new URL("../", import.meta.url).pathname;
const archiveDir = join(root, "site/_data/reports");
const page = readFileSync(join(root, "site/reports.md"), "utf8");
const START = "<!-- reports:start -->";
const END = "<!-- reports:end -->";

const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

function tempArchive(): string {
  return mkdtempSync(join(tmpdir(), "lateen-reports-"));
}

/** A stored release in `dir` with its real files and hashes. */
function store(dir: string, version: string, totals = { javascript: 12000, css: 6000 }): ReleaseEntry {
  mkdirSync(join(dir, version), { recursive: true });
  writeFileSync(join(dir, version, "a11y.json"), JSON.stringify({ tool: "lateen/a11y-report", version: 1 }));
  writeFileSync(join(dir, version, "performance.json"), JSON.stringify({ tool: "lateen/performance-report", version: 1 }));
  return {
    version,
    a11y: { file: "a11y.json", sha256: sha256(join(dir, version, "a11y.json")) },
    performance: { file: "performance.json", sha256: sha256(join(dir, version, "performance.json")) },
    totals,
  };
}

test("the stored archive matches its index, and every release has a page", () => {
  const index = readIndex(archiveDir);
  assert.deepEqual(verifyArchive(archiveDir), []);
  for (const release of index.releases) {
    assert.ok(existsSync(join(root, "site/reports", release.version, "index.md")), release.version);
  }
});

test("the reports page table is the one the index describes", () => {
  const table = tableOf(readIndex(archiveDir).releases);
  const start = page.indexOf(START);
  const end = page.indexOf(END);
  assert.ok(start !== -1 && end > start);
  assert.equal(page.slice(start + START.length, end).trim(), table.trim());
});

test("an edited stored report is a problem, and a missing one is too", () => {
  const dir = tempArchive();
  try {
    writeFileSync(join(dir, "index.yml"), stringify({ releases: [store(dir, "0.3.0")] }, { lineWidth: 0 }));
    assert.deepEqual(verifyArchive(dir), []);
    writeFileSync(join(dir, "0.3.0/a11y.json"), JSON.stringify({ tool: "lateen/a11y-report", version: 1, edited: true }));
    assert.match(verifyArchive(dir).join("\n"), /0\.3\.0\/a11y\.json: the file changed after it was archived/);
    rmSync(join(dir, "0.3.0/performance.json"));
    assert.match(verifyArchive(dir).join("\n"), /0\.3\.0\/performance\.json: the index records it, but the file is missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the index refuses a duplicate version and the table shows the change from the previous release", () => {
  const dir = tempArchive();
  try {
    const first = store(dir, "0.3.0", { javascript: 12000, css: 6000 });
    const second = store(dir, "0.3.1", { javascript: 13500, css: 5800 });
    writeFileSync(join(dir, "index.yml"), stringify({ releases: [first, second, first] }, { lineWidth: 0 }));
    assert.match(verifyArchive(dir).join("\n"), /0\.3\.0: the index lists this version twice/);
    const table = tableOf([first, second]);
    assert.match(table, /\[0\.3\.0\]\(\/reports\/0\.3\.0\/\).*\| — \|/);
    assert.match(table, /\[0\.3\.1\]\(\/reports\/0\.3\.1\/\).*\+1,500 B JavaScript, −200 B CSS/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a version that is not a release version is refused before anything is written", () => {
  assert.throws(() => archive("latest", "a.json", "p.json"), /is not a release version/);
});

test("the totals add every route's JavaScript and CSS gzip", () => {
  assert.deepEqual(
    totalsOf({ totals: [{ javascript: { gzip: 100 }, css: { gzip: 40 } }, { javascript: { gzip: 20 }, css: { gzip: 10 } }] }),
    { javascript: 120, css: 50 },
  );
  assert.deepEqual(totalsOf({}), { javascript: 0, css: 0 });
});

test("a slash path keeps a version with dots as one data key", () => {
  const site = { data: { reports: { "0.3.0": { a11y: { tool: "lateen/a11y-report" } } } } } as never;
  assert.deepEqual(dataAt(site, "reports/0.3.0/a11y"), { tool: "lateen/a11y-report" });
  assert.deepEqual(dataAt(site, "/reports/0.3.0/a11y/"), { tool: "lateen/a11y-report" });
  assert.equal(dataAt(site, "reports.0.3.0.a11y"), undefined);
});
