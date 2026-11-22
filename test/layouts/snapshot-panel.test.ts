import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { CollectionSnapshot } from "@velella/mizzen/contracts";
import list from "../../layouts/list.ts";
import record from "../../layouts/record.ts";
import { formatField } from "../../src/fields.ts";
import { layoutProps } from "../helpers-embed.ts";
import { pageWith } from "../helpers/page.ts";
import { recordProps } from "../helpers/record.ts";
import { siteConfig, siteOf } from "../helpers/site.ts";

function rendered(snapshot?: CollectionSnapshot): string[] {
  const page = pageWith({ lang: "fa", dir: "rtl" });
  const site = siteOf({ collections: {
    books: { name: "books", source: "books.yml", records: [], ...(snapshot === undefined ? {} : { snapshot }) },
  } });
  const props = layoutProps(page, site);
  return [
    renderToString(record({ ...props, record: recordProps() }) as never),
    renderToString(list({ ...props, list: { collection: "books", records: [], groups: [], pagination: { page: 1, total: 1 } } }) as never),
  ];
}

test("record and list disclose the collection's provenance in the page language", () => {
  const capturedAt = "2026-05-01T12:00:00Z";
  const snapshot = {
    source: "https://example.test/?a=1&b=2",
    ref: "abcdef",
    capturedAt,
    tool: "git",
    toolVersion: "2.50",
    schema: { file: "schema.json", version: "b".repeat(64), fields: {} },
  };
  const date = renderToString(formatField(capturedAt, "date", "fa", siteConfig()) as never);
  for (const html of rendered(snapshot)) {
    const panel = html.match(/<details class="details snapshot-panel"><summary>منبع داده<\/summary>.*?<\/details>/)?.[0];
    assert.ok(panel);
    assert.ok(panel.includes(date));
    assert.match(panel, /<time datetime="2026-05-01">/);
    for (const value of ["a=1&amp;b=2", "abcdef", "git", "2.50", "schema.json", snapshot.schema.version]) {
      assert.ok(panel.includes(value), value);
    }
  }
});

test("a collection with no snapshot has no provenance disclosure", () => {
  for (const html of rendered()) assert.doesNotMatch(html, /snapshot-panel/);
  for (const html of rendered({ source: "books.yml" })) {
    assert.match(html, /<bdi>books\.yml<\/bdi>/);
    assert.doesNotMatch(html, /زمان ثبت|نسخهٔ ابزار|طرحواره/);
  }
});
