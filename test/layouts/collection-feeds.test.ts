import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { attrs, build, textOf } from "../integration-helpers.ts";

test("list and record disclosures offer only their published collection feeds", () => {
  const config = readFileSync(new URL("../../fixtures/data-site/mizzen.yml", import.meta.url), "utf8");
  const origin = "https://example.test";
  const site = build("data-site", process.env, {
    "mizzen.yml": `${config}
url: ${origin}
base: /docs
feeds:
  releases:
    collection: releases
    date: date
    title: Release news
    formats: [atom, rss, json]
  empty:
    collection: releases
    date: no_date
  other:
    collection: components
    date: released
`,
    "releases.md": `---
title: Releases
list:
  collection: releases
---
`,
  });
  const files = ["feeds/releases.xml", "feeds/releases.rss.xml", "feeds/releases.json"];
  for (const route of ["/releases/4.0.0/", "/releases/"]) {
    const doc = site.document(route);
    const panel = doc.querySelector("details.list-subscribe");
    assert.ok(panel, route);
    assert.equal(panel.hasAttribute("open"), false);
    assert.equal(textOf(panel.querySelector("summary")), "Subscribe to feeds");
    assert.deepEqual(attrs(panel, "a", "href"), files.map((file) => `${origin}/docs/${file}`));
    assert.deepEqual(attrs(panel, "a", "type"), ["application/atom+xml", "application/rss+xml", "application/feed+json"]);
    for (const file of files) assert.notEqual(site.file(file), "");
  }
  const other = site.document("/components/button/");
  assert.deepEqual(attrs(other, "details.list-subscribe a", "href"), [`${origin}/docs/feeds/other.xml`]);
  assert.equal(site.document("/guide/").querySelector("details.list-subscribe"), null);
});
