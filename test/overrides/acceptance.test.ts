// A site that keeps the theme's unit names and replaces one component and one layout from its own
// folder. The build is the acceptance gate: the overridden shell and navigation appear, every other
// unit stays the theme's, the CSS sidecar is bundled under the base path, and a bad setting fails.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse, stringify } from "yaml";
import { root } from "../integration-helpers.ts";

const fixtures = join(root, "test/overrides/fixtures");
const bin = join(dirname(createRequire(import.meta.url).resolve("@velella/mizzen/package.json")), "bin/mizzen.js");

/** Runs `mizzen build` on a copy of a fixture, with the config edited by `change`. */
function build(name: "site" | "invalid", change: (config: Record<string, unknown>) => void = () => {}): {
  readonly out: string;
  readonly status: number;
  readonly output: string;
} {
  const dir = mkdtempSync(join(tmpdir(), `lateen-overrides-${name}-`));
  const site = join(dir, "site");
  cpSync(join(fixtures, name), site, { recursive: true });
  // A site installs the theme, and preact with it; the modules import the same copy the theme uses.
  symlinkSync(join(root, "node_modules"), join(site, "node_modules"), "dir");
  const file = join(site, "mizzen.yml");
  const config = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  change(config);
  writeFileSync(file, stringify(config));
  const out = join(dir, "out");
  const run = spawnSync(process.execPath, [bin, "build", site, "--theme", root, "--out", out], {
    encoding: "utf8",
    env: { ...process.env, NODE_V8_COVERAGE: "" },
  });
  return { out, status: run.status ?? 1, output: `${run.stdout}${run.stderr}` };
}

/** Every stylesheet the page links, concatenated: the engine writes one base bundle and one page bundle. */
function pageCss(out: string, html: string, base = ""): string {
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)">/g)].map((match) => match[1] ?? "");
  assert.ok(links.length > 0, "the page links its CSS");
  return links.map((href) => readFileSync(join(out, base === "" ? href : href.replace(new RegExp(`^${base}/`), "")), "utf8")).join("\n");
}

/** Removes `theme.overrides`, so the same page builds with the theme's own units. */
function noOverrides(config: Record<string, unknown>): void {
  const theme = config["theme"] as Record<string, unknown>;
  delete theme["overrides"];
}

test("a site replaces one component and one layout and keeps every other theme unit", () => {
  const plain = build("site", noOverrides);
  const overridden = build("site");
  try {
    assert.equal(plain.status, 0, plain.output);
    const before = readFileSync(join(plain.out, "index.html"), "utf8");
    assert.doesNotMatch(before, /site-shell|All guides/, "without overrides the theme's units render");

    assert.equal(overridden.status, 0, overridden.output);
    const html = readFileSync(join(overridden.out, "index.html"), "utf8");
    assert.match(html, /class="site-shell"/, "the layout override renders the site's shell");
    assert.match(html, /class="related-guides"[\s\S]*All guides/, "the component override replaces the theme's");
    assert.match(html, /Example site/, "the site's chrome is in the shell the layout places");
    assert.doesNotMatch(html, /class="doc"/, "the theme's doc layout is not kept as a fallback");

    assert.match(pageCss(overridden.out, html), /\.site-shell\{/, "the override's CSS sidecar is bundled");
  } finally {
    rmSync(dirname(overridden.out), { recursive: true, force: true });
    rmSync(dirname(plain.out), { recursive: true, force: true });
  }
});

test("the override and its assets keep the site's base path", () => {
  const built = build("site", (config) => {
    config["base"] = "/docs";
  });
  try {
    assert.equal(built.status, 0, built.output);
    const html = readFileSync(join(built.out, "index.html"), "utf8");
    assert.match(html, /class="site-shell"/);
    const hrefs = [...html.matchAll(/(?:href|src)="(\/docs\/[^"]+)"/g)].map((match) => match[1] ?? "");
    assert.ok(hrefs.length > 0, "every asset URL carries the base path");
    assert.ok(hrefs.every((href) => href.startsWith("/docs/")), "no URL escapes the base path");
    assert.match(pageCss(built.out, html, "/docs"), /\.site-shell\{/);
  } finally {
    rmSync(dirname(built.out), { recursive: true, force: true });
  }
});

test("an unknown unit and a missing file fail the build by name", () => {
  const built = build("invalid");
  try {
    assert.notEqual(built.status, 0, "an invalid override must not publish");
    assert.match(built.output, /overrides\.unknown-unit/);
    assert.match(built.output, /overrides\.missing-file/);
    assert.match(built.output, /theme\.overrides\.components\.site-nav/);
    assert.match(built.output, /theme\.overrides\.layouts\.doc/);
  } finally {
    rmSync(dirname(built.out), { recursive: true, force: true });
  }
});
