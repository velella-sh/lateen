import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import glossary, {
  ALIASES_CLASS,
  DEFINITION_CLASS,
  GROUP_CLASS,
  LETTER_CLASS,
  LIST_CLASS,
  TERM_CLASS,
  directive,
} from "../components/glossary/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

function siteWith(terms: readonly DataRecord[]): Site {
  return {
    config: { lang: "en", theme: { options: { glossary: { collection: "glossary" } } } },
    nav: {},
    data: {},
    pages: [],
    collections: { glossary: { name: "glossary", source: "glossary.yml", records: terms } },
  } as unknown as Site;
}

function render(terms: readonly DataRecord[], lang = "en"): string {
  const page = { lang, url: "/glossary/", frontMatter: {} } as unknown as Page;
  return renderToString(
    glossary({ props: {}, page, site: siteWith(terms), html: "" } as unknown as ComponentProps) as never,
  );
}

const english = [
  record("zebra", { term: "Zebra", definition: "A striped animal." }),
  record("apple", { term: "apple", definition: "A fruit.", aliases: ["malus", "pomme"] }),
  record("banana", { term: "Banana", definition: "A yellow fruit." }),
];

const persian = [
  record("p", { term: "پدر", definition: "سرپرست خانواده." }),
  record("t", { term: "تاریخ", definition: "گذشته." }),
  record("a", { term: "آب", definition: "مایه حیات." }),
  record("k", { term: "کتاب", definition: "مجموعه نوشته." }),
];

const arabic = [
  record("j", { term: "جمل", definition: "حيوان." }),
  record("b", { term: "بيت", definition: "منزل." }),
  record("t", { term: "تاج", definition: "زينة الرأس." }),
];

test("the directive is glossary", () => {
  assert.equal(directive, "glossary");
});

test("terms group by first letter, sorted with English collation", () => {
  const out = render(english);
  assert.match(
    out,
    new RegExp(
      `<section class="${GROUP_CLASS}" id="glossary-a"><h2 class="${LETTER_CLASS}">A</h2><dl class="${LIST_CLASS}"><dt class="${TERM_CLASS}" id="apple">apple</dt>`,
    ),
  );
  assert.ok(out.indexOf(">apple<") < out.indexOf(">Banana<"));
  assert.ok(out.indexOf(">Banana<") < out.indexOf(">Zebra<"));
  assert.equal((out.match(new RegExp(GROUP_CLASS, "g")) ?? []).length, 3);
  assert.deepEqual([...out.matchAll(/<h2 class="glossary-letter">([^<]*)<\/h2>/g)].map((m) => m[1]), ["A", "B", "Z"]);
});

test("each term has its record id, its definition and its other names", () => {
  const out = render(english);
  assert.match(out, /<dt class="glossary-term" id="zebra">Zebra<\/dt>/);
  assert.match(out, /<dd class="glossary-definition">A fruit\.<\/dd>/);
  assert.match(out, /<dd class="glossary-aliases">malus, pomme<\/dd>/);
  assert.equal((out.match(new RegExp(DEFINITION_CLASS, "g")) ?? []).length, 3);
  assert.equal((out.match(new RegExp(ALIASES_CLASS, "g")) ?? []).length, 1);
});

test("the definition keeps the Markdown the source holds, never as HTML", () => {
  const out = render([record("bold", { term: "Bold", definition: "A **bold** term." })]);
  assert.match(out, /<dd class="glossary-definition">A \*\*bold\*\* term\.<\/dd>/);
  assert.doesNotMatch(out, /<strong>/);
});

test("a Persian page sorts the Persian alphabet, not code points", () => {
  const out = render(persian, "fa");
  assert.deepEqual([...out.matchAll(/<h2 class="glossary-letter">([^<]*)<\/h2>/g)].map((m) => m[1]), ["آ", "پ", "ت", "ک"]);
  assert.ok(out.indexOf(">آب<") < out.indexOf(">پدر<"));
  assert.ok(out.indexOf(">پدر<") < out.indexOf(">تاریخ<"));
  assert.ok(out.indexOf(">تاریخ<") < out.indexOf(">کتاب<"));
});

test("an Arabic page groups and sorts in Arabic order", () => {
  const out = render(arabic, "ar");
  assert.deepEqual([...out.matchAll(/<h2 class="glossary-letter">([^<]*)<\/h2>/g)].map((m) => m[1]), ["ب", "ت", "ج"]);
  assert.ok(out.indexOf(">بيت<") < out.indexOf(">تاج<"));
  assert.ok(out.indexOf(">تاج<") < out.indexOf(">جمل<"));
});

test("a site with no terms renders nothing", () => {
  assert.equal(render([]), "");
  const bare = { config: { lang: "en" }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
  const page = { lang: "en", url: "/glossary/", frontMatter: {} } as unknown as Page;
  assert.equal(glossary({ props: {}, page, site: bare, html: "" } as unknown as ComponentProps), null);
});
