import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import glossary, { GROUP_CLASS, LETTER_CLASS, NAV_CLASS } from "../components/glossary/index.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, term: string): DataRecord => dataRecord({ id, fields: { term, definition: `${term} definition.` } });

function render(terms: readonly DataRecord[], lang = "en"): string {
  const site = {
    config: { lang, theme: { options: { glossary: { collection: "glossary" } } } },
    nav: {},
    data: {},
    pages: [],
    collections: { glossary: { name: "glossary", source: "glossary.yml", records: terms } },
  } as unknown as Site;
  const page = { lang, url: "/glossary/", frontMatter: {} } as unknown as Page;
  return renderToString(
    glossary({ props: {}, page, site, html: "" } as unknown as ComponentProps) as never,
  );
}

const links = (out: string): string[] => [...out.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]!);
const headings = (out: string): string[] =>
  [...out.matchAll(new RegExp(`<h2 class="${LETTER_CLASS}">([^<]*)</h2>`, "g"))].map((m) => m[1]!);

test("the letter index links to every group and nothing else", () => {
  const out = render([record("apple", "Apple"), record("cherry", "Cherry")]);
  assert.match(out, new RegExp(`<nav class="${NAV_CLASS}" aria-label="Browse by letter">`));
  assert.deepEqual(links(out), ["#glossary-a", "#glossary-c"]);
  assert.deepEqual(headings(out), ["A", "C"]);
  assert.doesNotMatch(out, /glossary-b/);
});

test("the index follows the English alphabet", () => {
  const out = render([record("z", "Zebra"), record("a", "Apple"), record("b", "Banana")]);
  assert.deepEqual(links(out), ["#glossary-a", "#glossary-b", "#glossary-z"]);
});

test("the index follows the Persian alphabet", () => {
  const out = render([record("p", "پدر"), record("t", "تاریخ"), record("a", "آب"), record("k", "کتاب")], "fa");
  assert.deepEqual(links(out), ["#glossary-آ", "#glossary-پ", "#glossary-ت", "#glossary-ک"]);
  assert.deepEqual(headings(out), ["آ", "پ", "ت", "ک"]);
  assert.match(out, new RegExp(`<nav class="${NAV_CLASS}" aria-label="مرور بر اساس حرف">`));
});

test("the index follows the Arabic alphabet", () => {
  const out = render([record("j", "جمل"), record("b", "بيت"), record("t", "تاج")], "ar");
  assert.deepEqual(links(out), ["#glossary-ب", "#glossary-ت", "#glossary-ج"]);
  assert.deepEqual(headings(out), ["ب", "ت", "ج"]);
  assert.match(out, new RegExp(`<nav class="${NAV_CLASS}" aria-label="تصفح حسب الحرف">`));
});

test("a one-letter glossary gets one link and one group", () => {
  const out = render([record("one", "One")]);
  assert.deepEqual(links(out), ["#glossary-o"]);
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 1);
  assert.match(out, /<section class="glossary-group" id="glossary-o">/);
});
