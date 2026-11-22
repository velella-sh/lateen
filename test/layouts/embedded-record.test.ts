import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { sourceText } from "../../components/code/index.ts";
import { build, root, type BuiltSite } from "../integration-helpers.ts";

/**
 * The data-site fixture is copied byte for byte from the engine and hash-checked, so this test adds a
 * named `embed` view through the builder's overlay instead of editing the fixture.
 */
const CONFIG = readFileSync(join(root, "fixtures/data-site/mizzen.yml"), "utf8")
  .replace("lang: en\n", "lang: en\nurl: https://example.com\n")
  .replace(
    "    permalink: /components/{slug}/\n    markdown: [summary]\n",
    [
      "    permalink: /components/{slug}/",
      "    markdown: [summary]",
      "    views:",
      "      embed:",
      "        template: _templates/components-embed.md",
      "        permalink: /components/{slug}/embed/",
      "        layout: embedded",
      "      summary:",
      "        template: _templates/components-summary.md",
      "        permalink: /components/{slug}/summary/",
      "        layout: doc",
      "      compact:",
      "        template: _templates/components-summary.md",
      "        permalink: /components/{slug}/compact/",
      "        layout: record",
      "",
    ].join("\n"),
  );

/** The view template: no heading, so the embedded layout draws the record's title and status. */
const VIEW = [
  "---",
  'title: "{name}"',
  'description: "An embedded view of the {name} component."',
  "layout: embedded",
  "embedded:",
  "  scheme: auto",
  "  height: 320",
  "record:",
  "  status: status",
  "  facts:",
  "    - field: id",
  "      label: Id",
  "    - field: released",
  "      label: Released",
  "      kind: date",
  "    - field: region",
  "      label: Region",
  "---",
  ":field[summary]",
  "",
].join("\n");

let site: BuiltSite;

before(() => {
  site = build("data-site", process.env, {
    "mizzen.yml": CONFIG,
    "_templates/components-embed.md": VIEW,
    "_templates/components-summary.md": '---\ntitle: "{name} summary"\n---\n:field[summary]\n',
  });
});

after(() => rmSync(site.out, { recursive: true, force: true }));

test("the record page shows working embed code for its embed view", () => {
  const html = site.html("/components/button/");
  assert.match(html, /<section class="record-embed" aria-labelledby="record-embed">/);
  assert.match(html, /<h2 id="record-embed">Embed this record<\/h2>/);
  assert.match(html, /<div class="embed-code"/);

  const text = sourceText(html);
  assert.match(
    text,
    /<iframe\n  src="https:\/\/example\.com\/components\/button\/embed\/"\n  title="Button"\n  width="100%"\n  height="320"\n  loading="lazy"\n  sandbox="allow-popups allow-top-navigation-by-user-activation"\n><\/iframe>/,
  );
  assert.match(text, /<a href="https:\/\/example\.com\/components\/button\/">Button<\/a>/);
});

test("a record without an embed view shows no embed code", () => {
  assert.doesNotMatch(site.html("/releases/4.0.0/"), /class="embed-code"/);
});

test("the embedded view renders the record's status and key facts with the record formatters", () => {
  const html = site.html("/components/button/embed/");
  assert.match(html, /<html lang="en" dir="ltr" data-scheme="auto" data-transparent="false">/);
  assert.match(html, /<div class="record-header"><h1>Button<\/h1><span class="record-status">/);
  assert.match(html, /<span class="field-status" data-value="stable"><span class="status status-neutral"/);
  assert.match(html, /<dt class="key-value-key">Id<\/dt><dd class="key-value-value record-fact" data-kind="text"><bdi dir="ltr">button<\/bdi><\/dd>/);
  assert.match(
    html,
    /<dt class="key-value-key">Released<\/dt><dd class="key-value-value record-fact" data-kind="date"[^>]*><time datetime="2026-01-12">12 January 2026<\/time><\/dd>/,
  );
  assert.match(html, /<dt class="key-value-key">Region<\/dt><dd class="key-value-value record-fact" data-kind="text"[^>]*>north<\/dd>/);
  assert.match(html, /<strong>button<\/strong>/, "the Markdown summary is rendered");
});

test("the embedded view has no script and points search engines and readers at the full record", () => {
  const html = site.html("/components/button/embed/");
  assert.doesNotMatch(html, /<script\b/i);
  assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/components\/button\/"\s*\/?>/);
  assert.match(html, /<a href="https:\/\/example\.com\/components\/button\/" target="_top" rel="noopener">Open the full page<\/a>/);
});

test("links to named views show on the record and the views link back in either layout", () => {
  const document = site.document("/components/button/");
  const views = document.querySelector('main nav[aria-label="Record views"]');
  assert.deepEqual([...views!.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]), [
    ["summary", "/components/button/summary/"],
    ["compact", "/components/button/compact/"],
  ]);
  assert.equal(document.querySelector(".sidebar a[href='/components/button/summary/']"), null);

  for (const name of ["summary", "compact"]) {
    const view = site.document(`/components/button/${name}/`);
    const link = view.querySelector("main .record-view-back a");
    assert.equal(link?.getAttribute("href"), "/components/button/");
    assert.equal(link?.textContent, "Open the full record");
    assert.equal(view.querySelector(".record-views"), null);
  }
});
