import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const here = import.meta.dirname;
const repo = join(here, "..", "..");
const site = join(here, "fixtures", "site");
const invalid = join(here, "fixtures", "invalid");
const mizzen = join(repo, "node_modules", ".bin", "mizzen");

/** Builds `target` with this checkout as the theme, the way a site builds it. */
function build(target: string, out: string): { status: number | null; output: string } {
  const result = spawnSync(mizzen, ["build", target, "--theme", repo, "--out", out], {
    cwd: repo,
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** A temp copy of the sample site whose `preact` import resolves through the repo's install. */
function copySite(into: string, base?: string): string {
  const copy = join(into, "site");
  cpSync(site, copy, { recursive: true });
  if (base !== undefined) {
    const file = join(copy, "mizzen.yml");
    writeFileSync(file, readFileSync(file, "utf8").replace(/^base: ""$/m, `base: ${base}`));
  }
  symlinkSync(join(repo, "node_modules"), join(into, "node_modules"), "dir");
  writeFileSync(join(into, "package.json"), '{"type": "module"}\n');
  return copy;
}

/** The local stylesheet paths a page links, in document order. */
function stylesheets(html: string, base = ""): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((href) => href.startsWith(`${base}/`))
    .map((href) => href.slice(base.length + 1));
}

/** Reads the linked stylesheets under `out`, failing when a page links a file that was not written. */
function styleText(out: string, html: string, base = ""): string {
  const paths = stylesheets(html, base);
  assert.ok(paths.length > 0, "the page links a stylesheet");
  return paths
    .map((path) => {
      const file = join(out, path);
      assert.ok(existsSync(file), `${path} is written beside the page`);
      return readFileSync(file, "utf8");
    })
    .join("\n");
}

test("the sample site renders its own doc layout, component and CSS", (t) => {
  const work = mkdtempSync(join(tmpdir(), "lateen-overrides-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));

  const out = join(work, "out");
  const result = build(site, out);
  assert.equal(result.status, 0, result.output);

  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.match(index, /class="site-shell"/, "the site's doc layout renders its shell");
  assert.match(index, /class="site-header"/, "the site's doc layout renders its header");
  assert.doesNotMatch(index, /<article class="doc"/, "the theme's doc layout is not loaded");
  assert.match(index, /class="callout callout-note"/, "the unoverridden callout still renders");
  assert.match(index, /The theme's callout is not overridden/);

  const related = readFileSync(join(out, "related", "index.html"), "utf8");
  assert.match(related, /<nav class="related-guides" aria-label="Guides"/, "the site's related-guides replacement renders");
  assert.match(related, /<a href="\/related\/">This guide<\/a>/);
  assert.match(related, /<a href="\/">All guides<\/a>/);
  assert.doesNotMatch(related, /related-guides-more/, "the theme's related-guides is not loaded");

  const css = styleText(out, related);
  assert.match(css, /\.site-shell\{/, "the doc override's CSS sidecar is served");
  assert.match(css, /\.related-guides\{/, "the component override's CSS sidecar is served");
  assert.match(styleText(out, index), /\.callout\{/, "the unoverridden component's CSS still ships");
});

test("the sample site keeps the base path on links and stylesheets", (t) => {
  const work = mkdtempSync(join(tmpdir(), "lateen-overrides-base-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));

  const copy = copySite(work, "/docs");
  const out = join(work, "out");
  const result = build(copy, out);
  assert.equal(result.status, 0, result.output);

  for (const page of ["index.html", join("related", "index.html")]) {
    const html = readFileSync(join(out, page), "utf8");
    for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
      assert.ok(href?.startsWith("/docs/"), `${page}: ${href} keeps the base path`);
    }
  }

  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.match(index, /class="site-header"><a href="\/docs\/">/, "the site header keeps the base path");

  const related = readFileSync(join(out, "related", "index.html"), "utf8");
  assert.match(related, /<a href="\/docs\/related\/">This guide<\/a>/);
  assert.match(related, /<a href="\/docs\/">All guides<\/a>/);

  const css = styleText(out, related, "/docs");
  assert.match(css, /\.site-shell\{/);
  assert.match(css, /\.related-guides\{/);
});

test("the invalid fixture fails the build with every named diagnostic", (t) => {
  const work = mkdtempSync(join(tmpdir(), "lateen-overrides-invalid-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));

  const result = build(invalid, join(work, "out"));
  assert.equal(result.status, 1, result.output);
  for (const id of ["overrides.unknown-unit", "overrides.missing-file", "overrides.outside-site"]) {
    assert.ok(result.output.includes(id), `${id} is reported`);
  }
  assert.match(result.output, /site-nav/);
  assert.match(result.output, /missing-doc\.ts/);
});

test("the doc and page-tool overrides apply at their registered render boundaries", (t) => {
  const work = mkdtempSync(join(tmpdir(), "lateen-overrides-scoped-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const copy = copySite(work);
  const config = join(copy, "mizzen.yml");
  writeFileSync(config, readFileSync(config, "utf8").replace(
    "    components:",
    "    components:\n      page-tool: overrides/page-tool.ts",
  ) + `collections:
  items:
    source: _data/items.json
    id: id
    template: _templates/items.md
    permalink: /items/{id}/
`);
  mkdirSync(join(copy, "_data"), { recursive: true });
  mkdirSync(join(copy, "_templates"), { recursive: true });
  writeFileSync(join(copy, "_data", "items.json"), '[{"id":"sample","title":"Sample record"}]\n');
  writeFileSync(join(copy, "_templates", "items.md"), `---
title: "{title}"
layout: record
tool: tool.js
---

::page-tool
`);
  writeFileSync(join(copy, "overrides", "page-tool.ts"), `
import { h } from "preact";
export default function tool() {
  return h("p", { class: "site-tool-override" }, "Custom tool");
}
`);
  writeFileSync(join(copy, "tool.js"), 'export {};\n');
  for (const layout of ["quickstart", "record"]) {
    writeFileSync(join(copy, `${layout}.md`), `---
title: ${layout}
layout: ${layout}
tool: tool.js
---

::page-tool
`);
  }

  const out = join(work, "out");
  const result = build(copy, out);
  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(join(out, "index.html"), "utf8"), /class="site-shell"/);
  const record = readFileSync(join(out, "items", "sample", "index.html"), "utf8");
  assert.match(record, /<article class="record"/, "generated records keep the record layout");
  assert.doesNotMatch(record, /class="site-shell"/);
  assert.match(record, /class="site-tool-override"/, "the registered directive override reaches generated records");
  assert.match(record, /class="page-tool-slot"/, "the generated record retains its automatic tool slot");
  for (const layout of ["quickstart", "record"]) {
    const html = readFileSync(join(out, layout, "index.html"), "utf8");
    assert.match(html, /<article class="doc"/, `${layout} uses the shared doc article`);
    assert.doesNotMatch(html, /class="site-shell"/, `${layout} keeps its own layout`);
    assert.match(html, /class="site-tool-override"/, "the explicit directive uses the component override");
    assert.match(html, /class="page-tool-slot"/, "the front matter tool uses the layout's renderer");
  }
});
