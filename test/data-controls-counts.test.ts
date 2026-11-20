import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { patternOf } from "../i18n/index.ts";
import compare from "../components/compare/index.ts";
import { rowsShownText } from "../components/compare/client.ts";
import { countText, type ExplorerElement } from "../components/data-explorer/client.ts";
import { PLURAL_CATEGORIES } from "../components/reading-time/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

/** A stand-in root that carries the same count patterns `index.ts` writes. */
function countRoot(lang: string): ExplorerElement {
  const attributes = new Map(
    PLURAL_CATEGORIES.map((category) => [
      `data-explorer-count-${category}`,
      patternOf(lang, `search_count_${category}`),
    ]),
  );
  return { getAttribute: (name: string) => attributes.get(name) ?? null } as unknown as ExplorerElement;
}

/** Directional marks `t()` may add around a value; they do not change the digits. */
const plain = (text: string): string => text.replace(/[\u200e\u200f\u2066-\u2069]/g, "");

const counts = [
  { lang: "en", texts: ["0 results.", "1 result.", "11 results."] },
  { lang: "fa", texts: ["۰ نتیجه.", "۱ نتیجه.", "۱۱ نتیجه."] },
  { lang: "ar", texts: ["٠ نتيجة.", "١ نتيجة.", "١١ نتيجة."] },
] as const;

test("the data explorer count uses the page language's plural rule and digits", () => {
  for (const { lang, texts } of counts) {
    [0, 1, 11].forEach((count, at) => {
      assert.equal(countText(countRoot(lang), lang, count), texts[at], `${lang} ${count}`);
    });
  }
});

test("the rows-shown status formats both counts in the page language's digits", () => {
  const digits = {
    en: { zero: "0", one: "1", eleven: "11" },
    fa: { zero: "۰", one: "۱", eleven: "۱۱" },
    ar: { zero: "٠", one: "١", eleven: "١١" },
  } as const;
  for (const { lang } of counts) {
    const template = patternOf(lang, "compare_rows_shown");
    const shown = digits[lang];
    assert.equal(
      rowsShownText(template, 0, 11, lang),
      template.replace("{count}", shown.zero).replace("{total}", shown.eleven),
      lang,
    );
    assert.equal(
      rowsShownText(template, 1, 11, lang),
      template.replace("{count}", shown.one).replace("{total}", shown.eleven),
      lang,
    );
    assert.equal(
      rowsShownText(template, 11, 11, lang),
      template.replace("{count}", shown.eleven).replace("{total}", shown.eleven),
      lang,
    );
  }
});

const a = record("a", { same: "x", diff: "1", only: "here" });
const b = record("b", { same: "x", diff: "2" });
const manyA = record("a", Object.fromEntries(Array.from({ length: 11 }, (_, at) => [`f${at}`, "1"])));
const manyB = record("b", Object.fromEntries(Array.from({ length: 11 }, (_, at) => [`f${at}`, "2"])));

const siteWith = (records: DataRecord[]): Site =>
  ({
    config: { base: "" },
    nav: {},
    data: {},
    pages: records.map((item) => ({ url: `/books/${item.id}/`, record: { collection: "books", id: item.id } })),
    collections: { books: { name: "books", source: "books.yml", records } },
  }) as unknown as Site;

function render(lang: string, records: DataRecord[], fields: readonly unknown[]): string {
  const page = { lang, url: "/books/", frontMatter: {} } as unknown as Page;
  const input = {
    props: { from: "books", ids: "a,b", fields: JSON.stringify(fields) },
    page,
    site: siteWith(records),
    html: "",
  } as unknown as ComponentProps;
  return plain(renderToString(compare(input) as never));
}

const threeFields = [{ field: "same" }, { field: "diff" }, { field: "only" }];
const elevenFields = Array.from({ length: 11 }, (_, at) => ({ field: `f${at}` }));

test("the compare summary and status use the page language's plural rule and digits", () => {
  const summaries = [
    { lang: "en", one: "1 same · 1 different · 1 missing", many: "0 same · 11 different · 0 missing" },
    { lang: "fa", one: "۱ یکسان · ۱ متفاوت · ۱ ناموجود", many: "۰ یکسان · ۱۱ متفاوت · ۰ ناموجود" },
    { lang: "ar", one: "١ متطابق · ١ مختلف · ١ مفقود", many: "٠ متطابق · ١١ مختلف · ٠ مفقود" },
  ] as const;
  const statuses = [
    { lang: "en", text: "3 of 3 rows shown", eleven: "11 of 11 rows shown" },
    { lang: "fa", text: "۳ از ۳ سطر نمایش داده می‌شود", eleven: "۱۱ از ۱۱ سطر نمایش داده می‌شود" },
    { lang: "ar", text: "يُعرض ٣ من ٣ صفوف", eleven: "يُعرض ١١ من ١١ صفوف" },
  ] as const;

  for (const { lang, one, many } of summaries) {
    const first = render(lang, [a, b], threeFields);
    assert.ok(first.includes(one), `${lang} summary: ${first}`);
    const status = statuses.find((item) => item.lang === lang);
    assert.ok(status !== undefined && first.includes(status.text), `${lang} status`);
  }

  for (const { lang, many } of summaries) {
    const second = render(lang, [manyA, manyB], elevenFields);
    assert.ok(second.includes(many), `${lang} many: ${second}`);
    const status = statuses.find((item) => item.lang === lang);
    assert.ok(status !== undefined && second.includes(status.eleven), `${lang} many status`);
  }
});
