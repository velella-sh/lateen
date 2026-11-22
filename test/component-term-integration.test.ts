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
  const terms = all(page, ".term:has(> button)");
  assert.equal(terms.length, 2, "one term by id and one by its label");

  const byId = page.querySelector('.term[data-term="network"]');
  assert.ok(byId, "the id prop selects the network term");
  assert.equal(textOf(byId.querySelector("button")), "Network");
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

test("the definition and the link are in the built HTML with no island", () => {
  const html = site.html("/terms/");
  assert.match(html, /<span class="term"/);
  assert.match(html, /<span class="term-definition">Two or more computers that talk\.<\/span>/);
  assert.doesNotMatch(html, /islands\/components\/term/);
});

test("inline terms and surrounding text stay in one paragraph", () => {
  const page = site.document("/terms/");
  const term = page.querySelector('p .term[data-term="network"]');
  assert.ok(term);
  assert.equal(term.closest("p")?.querySelectorAll(".term").length, 2);
  assert.match(term.closest("p")!.textContent, / is the delay between them\.$/);
});

test("the engine renders :symbol in running text with its own popover target", () => {
  const page = site.document("/terms/");
  const symbol = page.querySelector("p .symbol-popover");
  assert.ok(symbol);
  const button = symbol.querySelector("button");
  const panel = symbol.querySelector("[popover]");
  assert.ok(button && panel);
  assert.equal(button.textContent, "runExample");
  assert.equal(button.getAttribute("popovertarget"), panel.id);
  assert.equal(page.querySelectorAll(`[id="${panel.id}"]`).length, 1);
  assert.match(symbol.closest("p")!.textContent, / to run the example\.$/);
});
