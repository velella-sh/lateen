import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import term, {
  DEFINITION_CLASS,
  LABEL_CLASS,
  MARKER_CLASS,
  PANEL_CLASS,
  SR_CLASS,
  TERM_CLASS,
  TERM_OPTIONS,
  UNKNOWN_CLASS,
  directive,
  labelText,
} from "../components/term/index.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const terms = [
  record("network", { term: "Network", definition: "Two or more computers that talk.", aliases: ["Net"] }),
  record("latency", { term: "Latency", definition: "The time a packet takes to arrive." }),
  record("شبکه", { term: "شبکه", definition: "دو یا چند رایانه.", aliases: ["شبكه"] }),
];

function siteWith(
  records: readonly DataRecord[] = terms,
  options: Record<string, unknown> = { glossary: { collection: "glossary" } },
): Site {
  return {
    config: { lang: "en", theme: { options } },
    nav: {},
    data: {},
    pages: [],
    collections: { glossary: { name: "glossary", source: "glossary.yml", records } },
  } as unknown as Site;
}

/** Render the way the engine calls the component: the label's HTML, the directive props, and the page. */
function render(html: string, options: { id?: string; lang?: string; site?: Site } = {}): string {
  const page = { lang: options.lang ?? "en", url: "/guide/", frontMatter: {} } as unknown as Page;
  const props = options.id === undefined ? {} : { id: options.id };
  return renderToString(
    term({ props, html, page, site: options.site ?? siteWith() } as unknown as ComponentProps) as never,
  );
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);
const css = readFileSync(new URL("../components/term/style.css", import.meta.url), "utf8");

test("the directive is term and it reads one option", () => {
  assert.equal(directive, "term");
  assert.deepEqual([...TERM_OPTIONS], ["id"]);
  assert.equal(TERM_CLASS, "term");
  assert.equal(LABEL_CLASS, "term-label");
  assert.equal(PANEL_CLASS, "term-panel");
});

test("a known term is a native disclosure with the label as its summary", () => {
  const out = render("Network", { id: "network" });
  assert.match(out, /^<details class="term" data-term="network">/);
  assert.match(out, new RegExp(`^<details[^>]*><summary class="${LABEL_CLASS}">Network</summary>`));
  assert.match(out, /<p class="term-definition">Two or more computers that talk\.<\/p>/);
});

test("the label is the engine's HTML, kept as markup", () => {
  const out = render("the <strong>Network</strong> layer", { id: "network" });
  assert.match(out, /<summary class="term-label">the <strong>Network<\/strong> layer<\/summary>/);
});

test("without an id the label text finds the term by name or by another name", () => {
  const byName = render("Latency");
  assert.match(byName, /^<details class="term" data-term="latency">/);
  assert.match(byName, /The time a packet takes to arrive\./);

  const byAlias = render("Net");
  assert.match(byAlias, /^<details class="term" data-term="network">/);

  const markupLabel = render("<em>Net</em>");
  assert.match(markupLabel, /^<details class="term" data-term="network">/);
});

test("the id wins over the label, and a failed id is an unknown term", () => {
  const out = render("Latency", { id: "network" });
  assert.match(out, /^<details class="term" data-term="network">/);
  assert.match(out, /Two or more computers that talk\./);

  const typo = render("Network", { id: "nettwork" });
  assert.match(typo, /^<span class="term term-unknown" data-term="Network">/);
});

test("an unknown term is the label as plain text with a marker and a data attribute", () => {
  const out = render("Hypervisor");
  assert.equal(
    out,
    '<span class="term term-unknown" data-term="Hypervisor">Hypervisor<span class="term-marker" aria-hidden="true">?</span><span class="term-sr"> (No glossary entry)</span></span>',
  );
  assert.doesNotMatch(out, /<details|<summary|role="tooltip"/);
});

test("an unknown label's markup is not passed through", () => {
  const out = render("<strong>Hypervisor</strong> and <em>vm</em>");
  assert.match(out, /^<span class="term term-unknown" data-term="Hypervisor and vm">Hypervisor and vm/);
  assert.doesNotMatch(out, /<strong>|<em>/);
});

test("props are text: a value cannot add an attribute or an element", () => {
  const out = render("", { id: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(out, /<img\b/);
  assert.match(out, /data-term="&lt;img src=x onerror=&quot;alert\(1\)&quot;>"/);
});

test("the Persian page reads its terms and its strings in Persian", () => {
  const page = { en: "/glossary/", fa: "/fa/glossary/" };
  const known = render("شبكه", {
    lang: "fa",
    site: siteWith([terms[2]!], { glossary: { collection: "glossary", page } }),
  });
  assert.match(known, /^<details class="term" data-term="شبکه">/);
  assert.match(known, /<a class="term-link" href="\/fa\/glossary\/#شبکه">واژه‌نامه<\/a>/);

  const unknown = render("نامعلوم", { lang: "fa" });
  assert.match(unknown, /<span class="term-sr"> \(مدخلی در واژه‌نامه نیست\)<\/span>/);
});

test("the disclosure has no tooltip role or ARIA relationship", () => {
  const out = render("Network", { id: "network" });
  assert.doesNotMatch(out, /role="tooltip"|aria-describedby|aria-controls|tabindex/);
});

test("labelText drops tags, decodes the common entities, and trims", () => {
  assert.equal(labelText(" <strong>R&amp;D</strong> "), "R&D");
  assert.equal(labelText("a &lt; b"), "a < b");
});

test("style.css uses only token names from tokens/names.json", () => {
  const used = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]!);
  assert.ok(used.length > 0, "expected token var() references");
  const unknown = [...new Set(used)].filter((name) => !tokenNames.has(name.slice(2)));
  assert.deepEqual(unknown, []);
});

test("style.css uses logical properties and keeps a visible focus ring", () => {
  assert.doesNotMatch(css, /\b(margin|padding|border|inset)-(left|right|top|bottom)\b/);
  assert.doesNotMatch(css, /(^|[;{\s])(left|right|top|bottom)\s*:/m);
  assert.match(css, /\.term-label:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--state-focus-ring\)/s);
  assert.match(css, /\.term-panel\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /@media \(max-width: 40rem\)/);
  assert.match(css, /\.term-panel\s*\{[^}]*position:\s*static/s);
});

test("the panel is not hidden on screen: native details decides what is open", () => {
  assert.doesNotMatch(css, new RegExp(`\\.${PANEL_CLASS}\\s*\\{[^}]*display:\\s*none`, "s"));
  assert.doesNotMatch(css, new RegExp(`:hover\\s+\\.${PANEL_CLASS}`));
  const out = render("Network", { id: "network" });
  assert.doesNotMatch(out, /<details[^>]*\bopen\b/);
});
