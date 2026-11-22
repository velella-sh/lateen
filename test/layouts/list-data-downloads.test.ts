import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { CollectionConfig, SiteConfig } from "@velella/mizzen/contracts";
import list from "../../layouts/list.ts";
import { layoutProps } from "../helpers-embed.ts";
import { pageWith } from "../helpers/page.ts";
import { siteOf } from "../helpers/site.ts";

function render(raw: CollectionConfig["raw"], outputs: SiteConfig["outputs"] = {}, loaded = true): string {
  const page = pageWith({ url: "/docs/fa/books/", lang: "fa", dir: "rtl" });
  const site = siteOf({
    config: { base: "/docs", collections: { books: { source: "books.yml", id: "id", ...(raw === undefined ? {} : { raw }) } }, outputs },
    collections: loaded ? { books: { name: "books", source: "books.yml", records: [] } } : {},
  });
  return renderToString(list({ ...layoutProps(page, site), list: { collection: "books", records: [], groups: [], pagination: { page: 1, total: 1 } } }) as never);
}

test("list downloads respect collection and output settings and the base path", () => {
  const csvOnly = render(undefined, { "collection-json": false });
  assert.match(csvOnly, /دریافت داده‌ها/);
  assert.match(csvOnly, /href="\/docs\/data\/books\.csv"/);
  assert.match(csvOnly, /href="\/docs\/data\/books\.sha256"/);
  assert.doesNotMatch(csvOnly, /books\.raw\.json/);

  const jsonOnly = render(undefined, { "collection-csv": false });
  assert.match(jsonOnly, /href="\/docs\/data\/books\.raw\.json"/);
  assert.doesNotMatch(jsonOnly, /books\.(csv|sha256)/);

  assert.doesNotMatch(render(false), /id="collection-downloads"/);
  assert.doesNotMatch(render(undefined, {}, false), /id="collection-downloads"/);
  assert.doesNotMatch(render(undefined, { "collection-json": false, "collection-csv": false }), /id="collection-downloads"/);
});
