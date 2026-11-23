import assert from "node:assert/strict";
import { test } from "node:test";
import { all, build, type BuiltSite } from "./integration-helpers.ts";

/**
 * Verifies Mizzen's `theme.overrides` (0.2.4) against the whole theme, not one unit: the fixture
 * replaces `callout` and `status` (units other units and layouts use internally), `kbd` (a content
 * component) and the `doc` layout, each with a CSS sidecar. See docs/overrides.md, "Where an override
 * reaches", for what the engine cannot reach.
 */

let site: BuiltSite | undefined;
function built(): BuiltSite {
  site ??= build("theme-overrides", process.env, {}, { linkModules: true });
  return site;
}

/** Every stylesheet a page links, read from the output folder. */
function css(page: string): string {
  const html = built().html(page);
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => built().file(match[1]!.slice(1))).join("\n");
}

test("a layout override replaces the page shell for the layouts that are that layout", () => {
  const index = built().document("/");
  assert.equal(all(index, "main.site-doc").length, 1, "layout: doc renders the site's shell");
  assert.equal(all(index, "article.doc").length, 0, "the theme's doc article is not drawn");
  // Other layouts keep the theme's page, even the ones that share doc's article helper.
  assert.equal(all(built().document("/plain/"), "article.doc").length, 1, "quickstart keeps the theme's article");
  assert.equal(all(built().document("/plain/"), "main.site-doc").length, 0);
  assert.equal(all(built().document("/guide/"), "main.site-doc").length, 0, "guide is not the overridden layout");
  assert.equal(all(built().document("/tutorial/"), "main.site-doc").length, 0);
});

test("a content component override replaces the unit on every layout that uses it", () => {
  for (const page of ["/", "/guide/", "/tutorial/"]) {
    const doc = built().document(page);
    assert.equal(all(doc, "kbd.site-kbd").length, 1, `${page} draws the site's kbd`);
    assert.equal(all(doc, "kbd.kbd").length, 0, `${page} does not draw the theme's kbd`);
  }
});

test("a component the theme uses through directives and alerts is replaced everywhere the registry resolves it", () => {
  const index = built().document("/");
  // `> [!NOTE]` and `::callout` both resolve the name `callout`.
  assert.equal(all(index, "aside.site-callout").length, 2);
  assert.deepEqual(all(index, "aside.site-callout").map((element) => element.getAttribute("data-kind")), ["note", "tip"]);
  assert.equal(all(index, "span.site-status").length, 1, "the inline :status directive resolves the override");
  assert.equal(all(built().document("/guide/"), "aside.site-callout").length, 1, "an alert in another layout resolves it too");
});

test("known gap: units that import another unit directly bypass its override", () => {
  const index = built().document("/");
  // `info` and `hint` are separate units that call the theme's callout renderer. Overriding `callout` does not
  // reach them; the site would override `info` and `hint` themselves. Mizzen would need to hand a component
  // a way to render another registered unit by name (see the report in docs/overrides.md).
  assert.equal(all(index, ".callout.callout-note, .callout.callout-tip").length, 2, "aliased callouts are still the theme's");

  // The record and list layouts draw a record's status field through `src/fields.ts`, a direct import.
  for (const page of ["/tasks/one/"]) {
    const doc = built().document(page);
    assert.equal(all(doc, ".site-status").length, 0, `${page}: status fields are the theme's status`);
    assert.ok(all(doc, ".status").length > 0, `${page}: the theme's status is drawn`);
  }
});

test("a CSS sidecar ships on the pages that use its unit, and only those", () => {
  const index = css("/");
  assert.match(index, /\.site-callout\{/);
  assert.match(index, /\.site-status\{/);
  assert.match(index, /\.site-kbd\{/);
  assert.match(index, /\.site-doc\{/);
  assert.match(css("/guide/"), /\.site-callout\{/);
  assert.doesNotMatch(css("/guide/"), /\.site-doc\{/, "the layout sidecar is not sent to other layouts");
  assert.doesNotMatch(css("/tasks/"), /\.site-(callout|kbd|doc)\{/, "a page that uses none of them ships none");
});

test("units that were not overridden render unchanged", () => {
  // The theme's own CSS still ships beside the sidecars and the unaffected pages keep the theme's markup.
  assert.match(css("/"), /\.callout\{/, "the theme's callout CSS still ships for the aliases that use it");
  const tasks = built().document("/tasks/");
  assert.equal(all(tasks, "article.record-list, .record-table, .cards, table").length > 0, true, "the list layout is the theme's");
  const record = built().document("/tasks/one/");
  assert.equal(all(record, "article.record").length, 1);
});
