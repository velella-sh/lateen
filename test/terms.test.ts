import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataRecord, Site } from "@velella/mizzen/contracts";
import { findTerm, selectTerms } from "../src/terms.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const terms = [
  record("network", {
    term: { en: "Network", fa: "شبکه" },
    definition: { en: "Two or more computers that talk.", fa: "دو یا چند رایانه که با هم گفت‌وگو می‌کنند." },
    aliases: { en: ["Net"], fa: ["شبكه"] },
  }),
  record("latency", {
    term: "Latency",
    definition: "The time a packet takes to arrive.",
    aliases: ["Lag"],
  }),
  record("mtu", {
    term: "Maximum transmission unit",
    definition: "The largest packet a link carries.",
    aliases: [],
  }),
];

const siteWith = (collections: Record<string, unknown>, options?: Record<string, unknown>): Site =>
  ({
    config: { lang: "en", theme: { options: options ?? { glossary: { collection: "glossary" } } } },
    pages: [],
    collections: { glossary: { name: "glossary", source: "glossary.yml", records: terms }, ...collections },
  }) as unknown as Site;

const site = siteWith({});

test("reads the terms in the page language and falls back to the site's default language", () => {
  const fa = selectTerms(site, "fa");
  assert.equal(fa.length, 3);
  assert.equal(fa[0]?.id, "network");
  assert.equal(fa[0]?.term, "شبکه");
  assert.equal(fa[0]?.definition, "دو یا چند رایانه که با هم گفت‌وگو می‌کنند.");
  assert.deepEqual(fa[0]?.aliases, ["شبكه"]);
  assert.equal(fa[1]?.term, "Latency");
  assert.equal(fa[2]?.definition, "The largest packet a link carries.");

  const en = selectTerms(site, "en");
  assert.equal(en[0]?.term, "Network");
  assert.deepEqual(en[0]?.aliases, ["Net"]);
});

test("finds a term by its id, its text and another name", () => {
  const en = selectTerms(site, "en");
  assert.equal(findTerm(en, "network")?.id, "network");
  assert.equal(findTerm(en, "Maximum transmission unit")?.id, "mtu");
  assert.equal(findTerm(en, "Lag")?.id, "latency");
});

test("lookup ignores case and the Arabic/Persian letter forms", () => {
  assert.equal(findTerm(selectTerms(site, "en"), "NETWORK")?.id, "network");

  const fa = selectTerms(site, "fa");
  assert.equal(findTerm(fa, "شبكه")?.id, "network");
  assert.equal(findTerm(fa, "شبکه")?.id, "network");
});

test("a site with no glossary option, or one naming a missing collection, has no terms", () => {
  assert.deepEqual(selectTerms(siteWith({}, {}), "en"), []);
  assert.deepEqual(selectTerms(siteWith({}, { glossary: { collection: "words" } }), "en"), []);
});

test("an empty or unknown query finds no term", () => {
  const en = selectTerms(site, "en");
  assert.equal(findTerm(en, " "), undefined);
  assert.equal(findTerm(en, "nobody"), undefined);
});
