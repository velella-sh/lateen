import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig } from "@velella/mizzen/contracts";
import record from "../layouts/record.ts";
import { claimsOf, evidenceFieldOf } from "../src/evidence.ts";

const pos = { file: "components/button.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example",
  base: "",
  lang: "en",
  dir: "ltr",
  languages: [],
  source: ".",
  include: [],
  exclude: [],
  navigation: "_data/navigation.yml",
  defaults: [],
  theme: { options: {} },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
} as unknown as SiteConfig;

const fields = { name: "Button", pages: 3 };

const facts = [
  { field: "name", label: "Name" },
  { field: "pages", label: "Pages", kind: "number" },
];

function pageWith(): Page {
  return {
    url: "/components/button/",
    source: pos,
    frontMatter: { record: { facts } },
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>A control that starts an action.</p>",
    markdown: "A control that starts an action.",
    kind: "doc",
  } as unknown as Page;
}

interface EvidenceSiteOptions {
  /** The evidence field the collection names; `null` leaves the key out of the config. */
  readonly evidenceField?: string | null;
  /** The raw value of that field on the record. */
  readonly evidence?: unknown;
}

function siteWith(options: EvidenceSiteOptions = {}): Site {
  const evidenceField = options.evidenceField === undefined ? "evidence" : options.evidenceField;
  return {
    config: {
      ...config,
      collections: {
        components: {
          source: "components.yml",
          ...(evidenceField === null ? {} : { evidence: evidenceField }),
        },
      },
    } as SiteConfig,
    pages: [pageWith()],
    nav: { main: [] },
    data: {},
    collections: {
      components: {
        name: "components",
        source: "components.yml",
        records: [
          {
            id: "button",
            fields: evidenceField === null ? fields : { ...fields, [evidenceField]: options.evidence },
            position: pos,
            fieldPositions: {},
          },
        ],
      },
    },
  } as unknown as Site;
}

function render(options: EvidenceSiteOptions = {}): string {
  const page = pageWith();
  return renderToString(
    record({
      site: siteWith(options),
      page,
      trail: [{ title: "Components", url: "/components/" }, { title: page.title, url: page.url }],
      pager: { prev: { title: "Badge", url: "/components/badge/" }, next: { title: "Callout", url: "/components/callout/" } },
      head: { title: "Button · Example", meta: [], links: [], jsonLd: [] },
      islands: [],
      record: { collection: "components", id: "button", url: page.url, fields, links: {} },
    } as unknown as LayoutProps) as never,
  );
}

test("public claims render one link each beside their own fact, in source order", () => {
  const out = render({
    evidence: {
      name: [
        { id: "n1", title: "Release notes", url: "/notes/release/" },
        { id: "n2", title: "Spec", url: "https://example.org/spec" },
      ],
    },
  });
  assert.match(
    out,
    /<dt class="key-value-key">Name<\/dt><dd class="key-value-value record-fact" data-kind="text">Button<span class="record-fact-evidence"><a href="\/notes\/release\/">Release notes<\/a>, <a href="https:\/\/example.org\/spec">Spec<\/a><\/span><\/dd>/,
  );
  assert.equal(out.match(/record-fact-evidence/g)?.length, 1, "only the backed fact gets a span");
});

test("a field with no claims renders no evidence span", () => {
  const out = render({ evidence: { pages: [] } });
  assert.match(out, /<dt class="key-value-key">Pages<\/dt><dd class="key-value-value record-fact" data-kind="number">3<\/dd>/);
  assert.doesNotMatch(out, /record-fact-evidence/);
});

test("a collection that names no evidence field renders no evidence span", () => {
  const out = render({
    evidenceField: null,
    evidence: { name: [{ id: "n1", title: "Release notes", url: "/notes/release/" }] },
  });
  assert.match(out, />Button<\/dd>/);
  assert.doesNotMatch(out, /record-fact-evidence/);
});

test("claims with an unsafe URL or no title are skipped", () => {
  const out = render({
    evidence: {
      name: [
        { id: "js", title: "Script", url: "javascript:alert(1)" },
        { id: "proto", title: "Protocol relative", url: "//evil.example/x" },
        { id: "untitled", url: "/untitled/" },
        { id: "safe", title: "Safe", url: "/sources/safe/" },
      ],
    },
  });
  assert.match(out, /<span class="record-fact-evidence"><a href="\/sources\/safe\/">Safe<\/a><\/span>/);
  assert.doesNotMatch(out, /javascript:|evil\.example|>Script<|Protocol relative/);
});

test("private keys on a claim are never rendered", () => {
  const out = render({
    evidence: {
      name: [{ id: "n1", title: "Public", url: "/public/", note: "internal note", internal: "secret" }],
    },
  });
  assert.match(out, /<a href="\/public\/">Public<\/a>/);
  assert.ok(!out.includes("internal note"));
  assert.ok(!out.includes("secret"));
});

test("evidenceFieldOf ignores an absent site, an absent collection, and a blank or non-string field", () => {
  assert.equal(evidenceFieldOf(undefined, "components"), undefined);
  assert.equal(evidenceFieldOf({} as Site, "components"), undefined);
  assert.equal(evidenceFieldOf(siteWith({ evidenceField: 3 as never }), "components"), undefined);
  assert.equal(evidenceFieldOf(siteWith({ evidenceField: "   " }), "components"), undefined);
  assert.equal(evidenceFieldOf(siteWith({ evidenceField: null }), "components"), undefined);
  assert.equal(evidenceFieldOf(siteWith({ evidenceField: " sources " }), "components"), "sources");
});

test("claimsOf returns nothing for a missing record, collection, field, or shaped value", () => {
  const site = siteWith({ evidence: { name: [] } });
  assert.deepEqual(claimsOf(site, "components", "missing", "name"), []);
  assert.deepEqual(claimsOf(site, "missing", "button", "name"), []);
  assert.deepEqual(claimsOf(siteWith({ evidenceField: null }), "components", "button", "name"), []);
  assert.deepEqual(claimsOf(siteWith({ evidenceField: "  " }), "components", "button", "name"), []);
  assert.deepEqual(claimsOf(siteWith({ evidence: "not a record" }), "components", "button", "name"), []);
  assert.deepEqual(claimsOf(siteWith({ evidence: { name: "not a list" } }), "components", "button", "name"), []);
  assert.deepEqual(claimsOf(siteWith({ evidence: { name: undefined } }), "components", "button", "name"), []);
});

test("claimsOf skips malformed claims and keeps only safe, titled ones in order", () => {
  const claims = claimsOf(
    siteWith({
      evidence: {
        name: [
          null,
          7,
          {},
          { id: "", title: "No id", url: "/x/" },
          { id: "num-title", title: 7, url: "/x/" },
          { id: "blank", title: "   ", url: "/x/" },
          { id: "no-url", title: "No url" },
          { id: "num-url", title: "Number url", url: 7 },
          { id: "js", title: "Script", url: "javascript:alert(1)" },
          { id: "proto", title: "Protocol relative", url: "//evil.example/x" },
          { id: "backslash", title: "Backslash", url: "/\\evil.example" },
          { id: "first", title: "  First  ", url: "/sources/first/" },
          { id: "second", title: "Second", url: "https://example.org/second" },
        ],
      },
    }),
    "components",
    "button",
    "name",
  );
  assert.deepEqual(claims, [
    { id: "first", title: "First", url: "/sources/first/" },
    { id: "second", title: "Second", url: "https://example.org/second" },
  ]);
});
