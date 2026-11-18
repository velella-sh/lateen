import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import term, {
  CHIP_CLASS,
  DEFINITION_CLASS,
  directive,
  LINK_CLASS,
  MARKER_CLASS,
  OPTIONS,
  PANEL_CLASS,
  TERM_CLASS,
  UNKNOWN_CLASS,
} from "../components/term/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

function siteWith(
  terms: readonly DataRecord[],
  options: Record<string, unknown> = { glossary: { collection: "glossary" } },
  extra: Partial<Site> = {},
  base = "",
): Site {
  return {
    config: { lang: "en", base, theme: { options } },
    nav: {},
    data: {},
    pages: [],
    collections: { glossary: { name: "glossary", source: "glossary.yml", records: terms } },
    ...extra,
  } as unknown as Site;
}

const terms = [
  record("apple", { term: "Apple", definition: "A fruit.", aliases: ["malus"] }),
  record("widget", { term: "Widget", definition: "A **small** control." }),
];

function render(html: string, props: Record<string, string> = {}, site = siteWith(terms), lang = "en"): string {
  const page = { lang, url: "/guide/", frontMatter: {} } as unknown as Page;
  return renderToString(term({ props, page, site, html } as unknown as ComponentProps<TermProps>) as never);
}

type TermProps = { id?: string };

test("the directive is term and the only option is id", () => {
  assert.equal(directive, "term");
  assert.deepEqual([...OPTIONS], ["id"]);
});

test("a known term becomes a native disclosure with its definition", () => {
  const out = render("Widget");
  assert.match(out, new RegExp(`<details class="${TERM_CLASS}" data-term="Widget">`));
  assert.match(out, new RegExp(`<summary class="${CHIP_CLASS}">Widget</summary>`));
  assert.match(out, new RegExp(`<p class="${DEFINITION_CLASS}">A \\*\\*small\\*\\* control\\.</p>`));
});

test("a term is found by its id, its text, or another name, ignoring case", () => {
  for (const [html, props] of [
    ["anything", { id: "apple" }],
    ["apple", {}],
    ["MALUS", {}],
    ["  Widget ", {}],
  ] as const) {
    const out = render(html, props);
    assert.match(out, /<details class="term-popover"/, `${html} did not resolve`);
  }
});

test("the id wins over the visible text, and an unknown id stays unknown", () => {
  assert.match(render("Widget", { id: "apple" }), /data-term="Apple"/);
  assert.match(render("Apple", { id: "nosuch" }), /term-unknown/);
});

test("an unknown term stays plain text with a visible marker and no disclosure", () => {
  const out = render("Gadget");
  assert.doesNotMatch(out, /<details/);
  assert.match(out, new RegExp(`<span class="${TERM_CLASS} ${UNKNOWN_CLASS}" data-term="Gadget">`));
  assert.match(out, new RegExp(`<span class="${MARKER_CLASS}" aria-hidden="true">\\?</span>`));
});

test("an empty term renders nothing", () => {
  assert.equal(render("  "), "");
});

test("the label keeps the engine's inline markup and the definition is escaped text", () => {
  const out = render("<em>Widget</em>");
  assert.match(out, /<summary class="term-popover-chip"><em>Widget<\/em><\/summary>/);
  const escaped = render("Widget", {}, siteWith([record("widget", { term: "Widget", definition: "<script>x</script>" })]));
  assert.match(escaped, /&lt;script>x&lt;\/script>/);
  assert.doesNotMatch(escaped, /<script>/);
});

test("the panel links to the glossary page from theme.options.glossary.page", () => {
  const out = render("Widget", {}, siteWith(terms, { glossary: { collection: "glossary", page: "/glossary/" } }));
  assert.match(out, new RegExp(`<a class="${LINK_CLASS}" href="/glossary/#widget">Open in glossary</a>`));
});

test("the glossary page may be a mapping per language and keeps the site base", () => {
  const site = siteWith(terms, { glossary: { collection: "glossary", page: { en: "/glossary/", fa: "/واژه‌نامه/" } } }, {}, "/docs");
  assert.match(render("Widget", {}, site, "fa"), /href="\/docs\/واژه‌نامه\/#widget"/);
  assert.match(render("Widget", {}, site, "ar"), /href="\/docs\/glossary\/#widget"/, "a missing language falls back to the default");
});

test("a term with its own record page links there instead of the glossary anchor", () => {
  const page = {
    lang: "en",
    url: "/books/widget/",
    record: { collection: "glossary", id: "widget", template: "_templates/term.md", templateLine: 1, fallbacks: [] },
  } as unknown as Page;
  const site = siteWith(terms, { glossary: { collection: "glossary", page: "/glossary/" } }, { pages: [page] });
  const out = render("Widget", {}, site);
  assert.match(out, /<a class="term-popover-link" href="\/books\/widget\/">Read the full entry<\/a>/);
});

test("no glossary page and no record page renders no link", () => {
  const out = render("Widget");
  assert.doesNotMatch(out, new RegExp(LINK_CLASS));
  assert.match(out, new RegExp(PANEL_CLASS));
});
