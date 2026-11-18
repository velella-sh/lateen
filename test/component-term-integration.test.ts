import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { all, build, textOf, type BuiltSite } from "./integration-helpers.ts";

let site: BuiltSite;

before(() => {
  site = build("term");
});

after(() => rmSync(site.out, { recursive: true, force: true }));

test("the engine reaches the term component for an inline :term directive", () => {
  const page = site.document("/terms/");
  const details = all(page, "details.term");
  assert.equal(details.length, 2, "one term by id and one by its label");

  const byId = page.querySelector('details.term[data-term="network"]');
  assert.ok(byId, "the id prop selects the network term");
  assert.equal(textOf(byId.querySelector("summary")), "Network");
  assert.equal(textOf(byId.querySelector(".term-definition")), "Two or more computers that talk.");
  assert.equal(byId.querySelector(".term-link")?.getAttribute("href"), "/fixture/glossary/#network");

  assert.equal(page.querySelectorAll("div.term").length, 0, "a term is never a div");
  assert.equal(page.querySelectorAll("sl-component").length, 0, "the engine resolved the component");
});

test("an unknown inline term stays visible text with its marker", () => {
  const page = site.document("/terms/");
  const unknown = page.querySelector('.term-unknown[data-term="Quantum flux"]');
  assert.ok(unknown);
  assert.equal(textOf(unknown.querySelector(".term-sr")), "(No glossary entry)");
  assert.equal(textOf(unknown.querySelector(".term-marker")), "?");
  assert.equal(unknown.querySelector("details"), null);
});

test("the glossary component renders the same collection on its own page", () => {
  const page = site.document("/glossary/");
  assert.equal(all(page, ".glossary-group").length, 2, "Network and Latency each start a letter group");
  assert.ok(page.querySelector('.glossary-term[id="network"]'));
  assert.equal(textOf(page.querySelector('.glossary-term[id="network"]')), "Network");
});
