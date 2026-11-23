import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { builtPages, routeAssets } from "../scripts/performance-budget.ts";
import type { PreparedReport, ReportSet } from "@velella/mizzen/contracts";

const root = fileURLToPath(new URL("../", import.meta.url));

test("the report starter builds one model for HTML, trend tables and public JSON", (t) => {
  const work = mkdtempSync(join(tmpdir(), "lateen-report-viewer-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const starter = join(work, "site");
  cpSync(join(root, "starters/report"), starter, { recursive: true });
  const file = join(starter, "_data/report-set.json");
  const small = JSON.parse(readFileSync(file, "utf8")) as ReportSet;
  const many = {
    ...small.runs[0]!, id: "large", scope: "Large example",
    findings: Array.from({ length: 101 }, (_, index) => ({
      id: `finding-${index + 1}`, severity: "warning", message: `Finding ${index + 1}`,
    })),
  };
  writeFileSync(file, JSON.stringify({ ...small, runs: [...small.runs, many] }));

  const out = join(work, "out");
  execFileSync(process.execPath, [
    join(root, "node_modules/@velella/mizzen/bin/mizzen.js"), "build", starter,
    "--theme", root, "--out", out,
  ], { cwd: root, stdio: "pipe" });

  const html = (path: string) => readFileSync(join(out, path, "index.html"), "utf8");
  const view = (path: string) => new JSDOM(html(path)).window.document.querySelector("[data-report-view]");
  const reportFile = readFileSync(join(out, "checks/data.json"), "utf8");
  const report = JSON.parse(reportFile) as PreparedReport;
  const entries = (path: string) => {
    const table = [...view(path)!.querySelectorAll("table")].find((table) => table.caption?.textContent === "Recorded findings");
    return [...table!.querySelectorAll("tbody tr")].map((row) => row.textContent);
  };

  const large = report.runs.find(({ id }) => id === "large");
  assert.equal(large?.findings.length, 101);
  assert.equal(entries("checks/runs/large").length, 50);
  assert.equal(entries("checks/runs/large/page/2").length, 50);
  assert.match(entries("checks/runs/large/page/3").join(" "), /Warning\s*Finding 101/);
  assert.equal(view("checks/runs/large")?.querySelector('a[rel="next"]')?.getAttribute("href"), "/checks/runs/large/page/2/");
  assert.equal(view("checks/runs/large/page/3")?.querySelector('a[rel="prev"]')?.getAttribute("href"), "/checks/runs/large/page/2/");
  assert.equal(view("checks")?.querySelector('a[type="application/json"]')?.getAttribute("href"), report.jsonUrl);
  assert.match(view("checks")?.textContent ?? "", /HTML size \(KiB\).*35.*No value/);
  assert.equal(view("checks/compare/before/after")?.querySelectorAll("tbody tr").length, 2);
  assert.match(view("checks/compare/after/partial")?.textContent ?? "", /incomplete coverage/);
  assert.doesNotMatch(html("checks"), /chart\.min\.js|data:[^"]*application\/json/);
  const routes = builtPages(out);
  const assetsOf = (route: string) => routeAssets(out, routes.find((item) => item.url === route)!)
    .filter((asset) => /^(css|js)\//.test(asset.class))
    .map(({ class: kind, gzip }) => [kind, gzip] as const);
  for (const route of ["/checks/", "/checks/runs/large/", "/checks/compare/before/after/"]) {
    assert.deepEqual(assetsOf(route), assetsOf("/guide/"), `${route} exceeds the existing doc CSS and JavaScript inventory`);
  }
  const sizes = {
    overview: Buffer.byteLength(html("checks")),
    large: Buffer.byteLength(html("checks/runs/large")),
    json: Buffer.byteLength(reportFile),
  };
  // Measured on the packaged starter with 101 findings. Headroom covers ordinary shell changes.
  assert(sizes.overview <= 40_960, `Report overview HTML exceeded 40 KiB: ${sizes.overview}`);
  assert(sizes.large <= 65_536, `Paginated run HTML exceeded 64 KiB: ${sizes.large}`);
  assert(sizes.json <= 24_576, `Public report JSON exceeded 24 KiB: ${sizes.json}`);
});
