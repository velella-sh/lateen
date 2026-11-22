import assert from "node:assert/strict";
import { before, test } from "node:test";
import { all, build, type BuiltSite } from "../integration-helpers.ts";

let site: BuiltSite;
before(() => {
  site = build("integration");
});

const classes = (path: string) => (name: string) => all(site.document(path), `.${name}`).length;

test("the full showpiece fixture builds every section once, in order", () => {
  const count = classes("/showpiece/");
  for (const name of ["hero", "stat-strip", "feature-grid", "frame", "cta-band", "backdrop", "motif"]) assert.equal(count(name), 1, name);
  assert.equal(all(site.document("/showpiece/"), "h1").length, 1);
  const html = site.html("/showpiece/");
  const at = ['class="hero ', "stat-strip", "feature-grid", 'class="frame"', "cta-band"].map((m) => html.indexOf(m));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.ok(at[0]! >= 0);
});

test("the partial showpiece fixture draws only the sections it has data for", () => {
  const count = classes("/showpiece-partial/");
  assert.equal(count("hero"), 1);
  assert.equal(count("feature-grid"), 1);
  for (const name of ["stat-strip", "frame", "cta-band", "backdrop"]) assert.equal(count(name), 0, name);
  assert.match(site.html("/showpiece-partial/"), /A closing paragraph in the page body\./);
});
