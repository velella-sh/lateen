import assert from "node:assert/strict";
import { test } from "node:test";
import type { PageRecord } from "@velella/mizzen/contracts";
import { t } from "../../../i18n/index.ts";
import { hrefOf, pageWith, props, render } from "./helpers.ts";

const record: PageRecord = {
  collection: "books",
  id: "dune",
  position: { file: "data/books.yml", startLine: 12, startColumn: 3, endLine: 20, endColumn: 9 },
  template: "layouts/book.md",
  templateLine: 1,
  fallbacks: [],
};

/** A record page; the id in the issue body is the record's id, never a field value. */
function recordPage(overrides: Parameters<typeof pageWith>[0] = {}) {
  return pageWith({
    url: "/example/books/dune/",
    title: "Dune",
    frontMatter: { title: "Dune", isbn: "978-0441172719" },
    record,
    ...overrides,
  });
}

test("a record page names the collection, the id, and the data file line", () => {
  const url = hrefOf(render(props(recordPage())));
  assert.equal(url.searchParams.get("title"), "Dune");
  const body = url.searchParams.get("body") ?? "";
  assert.match(body, /I found a problem with this data\./);
  assert.match(body, /Page: \/example\/books\/dune\//);
  assert.match(body, /Collection: books/);
  assert.match(body, /Record: dune/);
  assert.match(body, /Language: en/);
  assert.doesNotMatch(body, /Source:/);
  assert.doesNotMatch(body, /978-0441172719/);
});

test("the data file is linked at the record's first line", () => {
  const body = hrefOf(render(props(recordPage()))).searchParams.get("body") ?? "";
  assert.match(
    body,
    /Data: \[data\/books\.yml:12\]\(https:\/\/github\.com\/velella-sh\/lateen\/blob\/main\/data\/books\.yml#L12\)/,
  );
});

test("the link is worded for data, translated in en, fa and ar", () => {
  for (const lang of ["en", "fa", "ar"]) {
    const html = render(props(recordPage({ lang, dir: lang === "en" ? "ltr" : "rtl" })));
    assert.ok(html.includes(t(lang, "report_data")), lang);
  }
  assert.equal(t("en", "report_data"), "Report a problem with this data");
  assert.notEqual(t("fa", "report_data"), t("en", "report_data"));
  assert.notEqual(t("ar", "report_data"), t("fa", "report_data"));
});

test("an ordinary page keeps its page wording and source line", () => {
  const url = hrefOf(render(props(pageWith())));
  const body = url.searchParams.get("body") ?? "";
  assert.match(body, /I found a problem with this page\./);
  assert.match(body, /Source: docs\/guide\/install\.md/);
  assert.doesNotMatch(body, /Collection:|Record:|Data:/);
  assert.ok(render(props(pageWith())).includes(t("en", "report_issue")));
});

test("a long record still fits the host's URL limit", () => {
  const long = recordPage({ record: { ...record, id: "x".repeat(9000) } });
  const url = hrefOf(render(props(long)));
  assert.ok(url.href.length <= 8000);
  const body = url.searchParams.get("body") ?? "";
  assert.match(body, /Collection: books/);
  assert.ok(body.endsWith("…"), "the body is cut with an ellipsis");
});
