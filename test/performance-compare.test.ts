import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareManifests } from "../scripts/performance-compare.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const schema = JSON.parse(readFileSync(new URL("../schema/performance-compare.schema.json", import.meta.url), "utf8")) as JsonSchema;
const commit = "de29199";

type Asset = { path: string; class: string; raw: number; gzip: number };
type Route = { route: string; assets: Asset[] };

const manifest = (routes: Route[], overrides: Record<string, unknown> = {}) => ({
  tool: "lateen/asset-manifest",
  version: 1,
  commit,
  mizzen: "0.2.5",
  routes,
  ...overrides,
});

const asset = (path: string, assetClass: string, gzip: number): Asset => ({ path, class: assetClass, raw: gzip * 2, gzip });
const route = (path: string, assets: Asset[]): Route => ({ route: path, assets });

const assets = (values: Record<string, [string, number]>): Asset[] =>
  Object.entries(values).map(([path, [assetClass, gzip]]) => asset(path, assetClass, gzip));

test("css, javascript, and font deltas are summed per route and each changed asset is named", () => {
  const shared: Record<string, [string, number]> = {
    "assets/theme/base.css": ["css/base", 300],
    "assets/theme/page.css": ["css/page", 100],
    "assets/theme/islands/chrome/nav.js": ["js/chrome", 200],
    "assets/theme/islands/components/foo/client.js": ["js/components", 400],
    "assets/theme/inline.js": ["js/inline", 50],
    "assets/theme/fonts/body.woff2": ["font/self-hosted", 500],
  };
  const base = manifest([route("/", assets(shared))]);
  const head = manifest([
    route(
      "/",
      assets({
        "assets/theme/base.css": ["css/base", 310],
        "assets/theme/page.css": ["css/page", 90],
        "assets/theme/islands/chrome/nav.js": ["js/chrome", 150],
        "assets/theme/islands/components/foo/client.js": ["js/components", 450],
        "assets/theme/inline.js": ["js/inline", 60],
        "assets/theme/fonts/body.woff2": ["font/self-hosted", 480],
      }),
    ),
  ]);

  const result = compareManifests(base, head, 100);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.routes.map((item) => item.route), ["/"]);
  const report = result.routes[0];
  assert.ok(report);
  assert.equal(report.css, 0);
  assert.equal(report.javascript, 10);
  assert.equal(report.font, -20);
  assert.equal(report.total, -10);
  assert.deepEqual(report.assets.map((item) => item.path), [
    "assets/theme/base.css",
    "assets/theme/fonts/body.woff2",
    "assets/theme/inline.js",
    "assets/theme/islands/chrome/nav.js",
    "assets/theme/islands/components/foo/client.js",
    "assets/theme/page.css",
  ]);
  const css = report.assets.find((item) => item.path === "assets/theme/base.css");
  assert.deepEqual(css, {
    path: "assets/theme/base.css",
    class: "css/base",
    base: 300,
    head: 310,
    delta: 10,
  });
  assert.deepEqual(result.totals, { css: 0, javascript: 10, font: -20, total: -10 });
});

test("a removed asset passes and is reported as a shrink", () => {
  const base = manifest([
    route("/", [asset("assets/theme/a.js", "js/components", 400), asset("assets/theme/b.js", "js/components", 100)]),
  ]);
  const head = manifest([route("/", [asset("assets/theme/a.js", "js/components", 400)])]);

  const result = compareManifests(base, head);
  assert.deepEqual(result.problems, []);
  assert.equal(result.routes[0]?.javascript, -100);
  assert.deepEqual(result.routes[0]?.assets, [
    { path: "assets/theme/b.js", class: "js/components", base: 100, delta: -100 },
  ]);
});

test("an added asset always fails, even when the tolerance is generous", () => {
  const base = manifest([route("/", [asset("assets/theme/a.js", "js/components", 400)])]);
  const head = manifest([
    route("/", [asset("assets/theme/a.js", "js/components", 400), asset("assets/theme/b.js", "js/components", 10)]),
  ]);

  const result = compareManifests(base, head, 1_000);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0] ?? "", /assets\/theme\/b\.js is a new asset/);
  assert.equal(result.routes[0]?.javascript, 10);
});

test("growth at the tolerance passes and one byte past it fails", () => {
  const base = manifest([route("/", [asset("assets/theme/a.js", "js/components", 1_000)])]);
  const at = manifest([route("/", [asset("assets/theme/a.js", "js/components", 1_100)])]);
  const past = manifest([route("/", [asset("assets/theme/a.js", "js/components", 1_101)])]);

  assert.deepEqual(compareManifests(base, at, 100).problems, []);
  const one = compareManifests(base, past, 100).problems;
  assert.equal(one.length, 1);
  assert.match(one[0] ?? "", /grew by 101 B gzip \(1000 B to 1101 B, tolerance 100 B\)/);
  assert.equal(compareManifests(base, past).problems.length, 1);
});

test("a route on one side only fails, and the shared routes are still compared", () => {
  const base = manifest([
    route("/", [asset("assets/theme/a.js", "js/components", 400)]),
    route("/gone/", [asset("assets/theme/a.js", "js/components", 400)]),
  ]);
  const head = manifest([
    route("/", [asset("assets/theme/a.js", "js/components", 400)]),
    route("/new/", [asset("assets/theme/a.js", "js/components", 400)]),
  ]);

  const result = compareManifests(base, head);
  assert.deepEqual(result.routes.map((item) => item.route), ["/"]);
  assert.equal(result.problems.length, 2);
  assert.match(result.problems.join("\n"), /route \/gone\/: only in base/);
  assert.match(result.problems.join("\n"), /route \/new\/: only in head/);
});

test("a duplicate path in one route is a problem and no comparison is reported", () => {
  const valid = manifest([route("/", [asset("assets/theme/a.js", "js/components", 400)])]);
  const duplicate = manifest([
    route("/", [asset("assets/theme/a.js", "js/components", 400), asset("assets/theme/a.js", "js/chrome", 400)]),
  ]);

  const result = compareManifests(valid, duplicate);
  assert.deepEqual(result.routes, []);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0] ?? "", /assets\/theme\/a\.js is listed more than once/);
});

test("an invalid tool, version, or commit fails both sides", () => {
  const valid = manifest([route("/", [])]);
  for (const [name, broken, pattern] of [
    ["tool", manifest([], { tool: "lateen/other" }), /tool is "lateen\/other"/],
    ["version", manifest([], { version: 2 }), /version is 2, expected 1/],
    ["commit", manifest([], { commit: "not-a-commit" }), /commit "not-a-commit" is not 7-40 lowercase hex/],
  ] as const) {
    const result = compareManifests(broken, valid);
    assert.equal(result.problems.length, 1, name);
    assert.match(result.problems[0] ?? "", pattern);
    assert.deepEqual(result.routes, []);
  }
});

test("the CLI writes a report that satisfies schema/performance-compare.schema.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "lateen-compare-"));
  try {
    const baseFile = join(dir, "base.json");
    const headFile = join(dir, "head.json");
    const reportFile = join(dir, "report.json");
    writeFileSync(baseFile, JSON.stringify(manifest([route("/", [asset("assets/theme/a.js", "js/components", 400)])])));
    writeFileSync(
      headFile,
      JSON.stringify(
        manifest([
          route("/", [asset("assets/theme/a.js", "js/components", 400), asset("assets/theme/b.js", "js/components", 10)]),
        ]),
      ),
    );

    const run = spawnSync(
      process.execPath,
      [join(root, "scripts/performance-compare.ts"), "--base", baseFile, "--head", headFile, "--report", reportFile],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /is a new asset/);

    const report = JSON.parse(readFileSync(reportFile, "utf8")) as {
      tool: string;
      version: number;
      base: string;
      head: string;
      tolerance: number;
      routes: { route: string; javascript: number }[];
      problems: string[];
    };
    assert.deepEqual(validate(schema, report), []);
    assert.equal(report.tool, "lateen/performance-compare");
    assert.equal(report.version, 1);
    assert.equal(report.base, commit);
    assert.equal(report.head, commit);
    assert.equal(report.tolerance, 0);
    assert.equal(report.routes[0]?.javascript, 10);
    assert.equal(report.problems.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
