// prepack must build and verify every artifact the installed theme needs, not only the chart bundle:
// the compiled CSS ships in the tarball, and the required list covers units, islands, fonts, tokens,
// translations, schemas, the visual export, the redesign alias, the skill, and the starters.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { main, missingArtifacts, requiredArtifacts, root } from "../scripts/check-package.ts";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
  files: string[];
};

test("prepack builds every generated asset and then verifies the required artifacts", () => {
  assert.equal(pkg.scripts.prepack, "npm run ui:build && node scripts/check-package.ts");
  assert.ok(pkg.files.includes("styles/generated.css"), "the compiled CSS ships in the tarball");
  assert.equal(pkg.files.includes("!styles/generated.css"), false, "the compiled CSS is not excluded");
  assert.ok(pkg.files.includes("components/performance-chart/chart.min.js"), "the chart bundle ships");
});

test("the required list covers sources, islands, fonts, schemas, and generated assets, once each in order", () => {
  const required = requiredArtifacts();
  for (const path of [
    "src/index.ts",
    "layouts/doc.ts",
    "chrome/toc/client.ts",
    "components/code/index.ts",
    "components/performance-chart/chart.min.js",
    "styles/src/ui.css",
    "styles/generated.css",
    "styles/fonts.css",
    "fonts/manrope/manrope-latin-400-normal.woff2",
    "fonts/vazirmatn/vazirmatn-arabic-400-normal.woff2",
    "i18n/en.json",
    "tokens/presets/harbor.json",
    "schema/options.schema.json",
    "visual/index.ts",
    "redesign/src/index.ts",
    "skills/lateen/SKILL.md",
    "starters/docs/starter.json",
  ]) {
    assert.ok(required.includes(path), `${path} is required`);
  }
  assert.deepEqual(required, [...required].sort(), "paths are in path order");
  assert.equal(new Set(required).size, required.length, "no path is required twice");
});

test("missingArtifacts names absent and empty files, and passes a complete copy", () => {
  const dir = mkdtempSync(join(tmpdir(), "package-artifacts-"));
  try {
    const required = ["a/index.ts", "b/font.woff2"];
    assert.deepEqual(missingArtifacts(dir, required), ["a/index.ts", "b/font.woff2"]);
    mkdirSync(join(dir, "a"), { recursive: true });
    writeFileSync(join(dir, "a/index.ts"), "export const x = 1;");
    mkdirSync(join(dir, "b"), { recursive: true });
    writeFileSync(join(dir, "b/font.woff2"), "");
    assert.deepEqual(missingArtifacts(dir, required), ["b/font.woff2"], "an empty file ships no bytes");
    writeFileSync(join(dir, "b/font.woff2"), "font-bytes");
    assert.deepEqual(missingArtifacts(dir, required), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the working tree holds every required artifact after ui:build", () => {
  assert.deepEqual(missingArtifacts(root), []);
});

test("check-package reports on stderr so npm pack --json stdout stays parseable", () => {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (message: string) => void out.push(message);
  console.error = (message: string) => void err.push(message);
  try {
    main([root]);
  } finally {
    console.log = log;
    console.error = error;
  }
  assert.deepEqual(out, []);
  assert.equal(err.length, 1);
  assert.match(err[0] ?? "", /required theme artifacts are present/);
});