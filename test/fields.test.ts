import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { SiteConfig } from "@velella/mizzen/contracts";
import {
  EMPTY_CLASS,
  FIELD_KINDS,
  LIST_CLASS,
  NOT_APPLICABLE_CLASS,
  STATUS_CLASS,
  formatField,
  isEmpty,
  kindOf,
  valueState,
} from "../src/fields.ts";
import { sortKey, sortRows } from "../src/sort.ts";

const config = { base: "/docs" } as unknown as SiteConfig;

function render(value: unknown, kind: unknown = "text", lang = "en"): string {
  return renderToString(formatField(value, kind, lang, config) as never);
}

test("there are eight kinds and an unknown kind is text", () => {
  assert.deepEqual([...FIELD_KINDS], ["text", "number", "boolean", "date", "url", "list", "status", "days"]);
  assert.equal(kindOf("date"), "date");
  assert.equal(kindOf("nope"), "text");
  assert.equal(kindOf(3), "text");
});

test("text renders as written and escapes markup", () => {
  assert.equal(render("Tehran"), "Tehran");
  assert.equal(render("Tehran", "text", "fa"), "Tehran");
  assert.equal(render("Tehran", "text", "ar"), "Tehran");
  assert.equal(render("<b>bold</b>"), "&lt;b>bold&lt;/b>");
  assert.equal(render("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)>");
});

test("a number uses the page language's digits", () => {
  assert.equal(render(1234, "number", "en"), "1,234");
  assert.equal(render(1234, "number", "fa"), "۱٬۲۳۴");
  assert.equal(render(1234, "number", "ar"), "1,234");
  assert.equal(render("1234", "number", "fa"), "۱٬۲۳۴");
  assert.equal(render("not a number", "number", "en"), "not a number");
});

test("a boolean reads yes or no in the page language", () => {
  assert.equal(render(true, "boolean", "en"), "Yes");
  assert.equal(render(false, "boolean", "en"), "No");
  assert.equal(render(true, "boolean", "fa"), "بله");
  assert.equal(render(false, "boolean", "fa"), "خیر");
  assert.equal(render("true", "boolean", "ar"), "نعم");
  assert.equal(render("maybe", "boolean", "en"), "maybe");
});

test("a date uses the page language's calendar and keeps its ISO form", () => {
  const en = render("2026-11-09", "date", "en");
  assert.equal(en, '<time datetime="2026-11-09">November 9, 2026</time>');
  assert.match(render("2026-11-09", "date", "fa"), /^<time datetime="2026-11-09">۱۸ آبان ۱۴۰۵<\/time>$/);
  assert.match(render("2026-11-09", "date", "ar"), /^<time datetime="2026-11-09">.+<\/time>$/);
  assert.equal(render("2026-02-30", "date", "en"), "2026-02-30");
});

test("only https and root-relative URLs become links, and a local one gets the base", () => {
  assert.equal(render("https://example.com/a?b=1", "url"), '<a href="https://example.com/a?b=1">https://example.com/a?b=1</a>');
  assert.equal(render("/guide/", "url"), '<a href="/docs/guide/">/guide/</a>');
  for (const unsafe of ["javascript:alert(1)", "//evil.example/x", "http://plain.example", "data:text/html,x", "tel:123"]) {
    assert.equal(render(unsafe, "url"), unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  }
});

test("a list is an unordered list, and a value that is not a list reads as text", () => {
  assert.equal(render(["alpha", "beta"], "list"), `<ul class="${LIST_CLASS}"><li>alpha</li><li>beta</li></ul>`);
  assert.equal(render([1, 2], "list"), `<ul class="${LIST_CLASS}"><li>1</li><li>2</li></ul>`);
  assert.equal(render("one", "list"), "one");
});

test("a missing value is one placeholder with a text alternative in every language", () => {
  for (const missing of [undefined, "", "   ", []]) {
    assert.equal(valueState(missing), "missing");
    assert.equal(isEmpty(missing), true);
  }
  for (const kept of [0, false, "0", [0]]) {
    assert.equal(valueState(kept), undefined);
    assert.equal(isEmpty(kept), false);
  }
  assert.equal(render(undefined, "date", "fa"), `<span class="${EMPTY_CLASS}" data-state="missing">بدون مقدار</span>`);
  assert.equal(render("", "url", "ar"), `<span class="${EMPTY_CLASS}" data-state="missing">لا قيمة</span>`);
  assert.equal(render([], "list", "en"), `<span class="${EMPTY_CLASS}" data-state="missing">No value</span>`);
});

test("an explicit null is not applicable, distinct from missing and from zero", () => {
  assert.equal(valueState(null), "not-applicable");
  assert.equal(isEmpty(null), true);
  assert.equal(
    render(null, "number", "en"),
    `<span class="${NOT_APPLICABLE_CLASS}" data-state="not-applicable">Not applicable</span>`,
  );
  assert.equal(
    render(null, "date", "fa"),
    `<span class="${NOT_APPLICABLE_CLASS}" data-state="not-applicable">ناموجود</span>`,
  );
  assert.equal(
    render(null, "text", "ar"),
    `<span class="${NOT_APPLICABLE_CLASS}" data-state="not-applicable">لا ينطبق</span>`,
  );
  assert.equal(render(0, "number", "en"), "0");
  assert.equal(render(0, "number", "fa"), "۰");
  assert.equal(render("0.0", "number", "en"), "0");
});

test("zero stays a sortable value and empty values stay last", () => {
  const rows: unknown[] = [2, null, 0, undefined, "0.0"];
  const key = (value: unknown) => sortKey(value, "number");
  assert.deepEqual(sortRows(rows, key, "number", "ascending", "en"), [0, "0.0", 2, null, undefined]);
  assert.deepEqual(sortRows(rows, key, "number", "descending", "en"), [2, 0, "0.0", null, undefined]);
  assert.equal(sortKey(0, "number"), 0);
  assert.equal(sortKey(0, "days"), 0);
});

test("a status value renders through the site's map and keeps the raw value", () => {
  const mapped = { base: "", theme: { options: { status: { values: { done: { tone: "positive", label: { en: "Done", fa: "انجام شد" } } } } } } } as unknown as SiteConfig;
  const en = renderToString(formatField("done", "status", "en", mapped) as never);
  assert.match(en, new RegExp(`class="${STATUS_CLASS}" data-value="done"`));
  assert.match(en, /class="status status-positive"/);
  assert.match(en, />Done<\/span>/);
  assert.match(renderToString(formatField("done", "status", "fa", mapped) as never), />انجام شد<\/span>/);
  assert.match(renderToString(formatField("done", "status", "en", config) as never), /class="status status-neutral"/);
  assert.match(renderToString(formatField("done", "status", "en", config) as never), />done<\/span>/);
});
