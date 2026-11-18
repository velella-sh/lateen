import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { RecordProps } from "@velella/mizzen/contracts";
import { PLURAL_CATEGORIES } from "../components/reading-time/index.ts";
import { stringsOf } from "../i18n/index.ts";
import { EMPTY_CLASS, fieldValueOf, formatField, kindOf } from "../src/fields.ts";

function render(value: unknown, lang = "en"): string {
  return renderToString(formatField(value, "days", lang) as never);
}

test("a positive count is days left, a negative one is days ago, and zero is today", () => {
  const samples = [
    { lang: "en", left: "3 days left", ago: "3 days ago", today: "Today" },
    { lang: "fa", left: "۳ روز باقی مانده", ago: "۳ روز پیش", today: "امروز" },
    { lang: "ar", left: "متبقٍ ٣ يوم", ago: "قبل ٣ يوم", today: "اليوم" },
  ];
  for (const { lang, left, ago, today } of samples) {
    assert.equal(render(3, lang), left, `${lang} future`);
    assert.equal(render(-3, lang), ago, `${lang} past`);
    assert.equal(render(0, lang), today, `${lang} today`);
  }
});

test("the digits and the plural form follow the page language", () => {
  assert.equal(render(1, "en"), "1 day left");
  assert.equal(render(2, "en"), "2 days left");
  assert.equal(render(-1, "en"), "1 day ago");
  assert.equal(render(-2, "en"), "2 days ago");
  assert.equal(render(1, "fa"), "۱ روز باقی مانده");
  assert.equal(render(2, "fa"), "۲ روز باقی مانده");
  assert.equal(render(-1, "ar"), "قبل ١ يوم");
  assert.equal(render(-2, "ar"), "قبل ٢ يوم");
});

test("every plural category has a string in every catalog", () => {
  for (const lang of ["en", "fa", "ar"] as const) {
    const catalog = stringsOf(lang);
    for (const direction of ["field_days_left", "field_days_ago"]) {
      for (const category of PLURAL_CATEGORIES) {
        assert.equal(
          typeof catalog[`${direction}_${category}`],
          "string",
          `${lang} has ${direction}_${category}`,
        );
      }
    }
  }
});

test("a missing derived value is the placeholder, never zero", () => {
  const withoutDates: Pick<RecordProps, "fields" | "derived"> = { fields: { title: "No date" } };
  assert.equal(fieldValueOf(withoutDates, "derived.daysLeft"), undefined);
  assert.equal(
    render(fieldValueOf(withoutDates, "derived.daysLeft")),
    `<span class="${EMPTY_CLASS}">No value</span>`,
  );
  assert.equal(
    render(fieldValueOf(withoutDates, "derived.daysLeft"), "fa"),
    `<span class="${EMPTY_CLASS}">بدون مقدار</span>`,
  );
  assert.equal(
    render(fieldValueOf(withoutDates, "derived.daysLeft"), "ar"),
    `<span class="${EMPTY_CLASS}">لا قيمة</span>`,
  );
});

test("a record without derived values keeps its own fields", () => {
  const record: Pick<RecordProps, "fields" | "derived"> = { fields: { title: "Alpha", daysLeft: 4 } };
  assert.equal(fieldValueOf(record, "daysLeft"), 4);
  assert.equal(fieldValueOf(record, "derived.daysLeft"), undefined);
  assert.equal(render(fieldValueOf(record, "derived.daysLeft")), `<span class="${EMPTY_CLASS}">No value</span>`);
});

test("the derived source reads the engine's value, not a field of the same name", () => {
  const record: Pick<RecordProps, "fields" | "derived"> = {
    fields: { title: "Alpha", daysLeft: 99 },
    derived: { daysLeft: -4, state: "expired" },
  };
  assert.equal(fieldValueOf(record, "derived.daysLeft"), -4);
  assert.equal(render(fieldValueOf(record, "derived.daysLeft")), "4 days ago");
  assert.equal(fieldValueOf(record, "derived.state"), "expired");
  assert.equal(fieldValueOf(record, "title"), "Alpha");
  assert.equal(fieldValueOf(record, "derived.missing"), undefined);
});

test("days is a field kind", () => {
  assert.equal(kindOf("days"), "days");
  assert.equal(kindOf("nope"), "text");
});
