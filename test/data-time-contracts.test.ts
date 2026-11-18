import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { build, root, type BuiltSite } from "./integration-helpers.ts";

/**
 * The data-time contract tests: the engine's optional record and page data reaches this theme's
 * fixture without changing the pages a site that leaves it out already builds.
 *
 * The shared `data-site` fixture stays byte for byte as the engine's copy, so the `items` collection
 * and the review lock are added through the builder's overlay. Only the date rules, the calendars,
 * the history, and the stale state are optional; the rest of the site is the same in both builds.
 */

const BASE = readFileSync(join(root, "fixtures/data-site/mizzen.yml"), "utf8");

/** The fixture config with the `items` collection added; `extra` holds its optional keys. */
function configWith(extra: string, calendars = ""): string {
  const items = [
    "collections:",
    "  items:",
    "    source: _data/items.yml",
    "    template: _templates/items.md",
    "    permalink: /items/{id}/",
    ...extra.split("\n").filter((line) => line !== ""),
  ].join("\n");
  return `${BASE.replace(/^collections:$/m, items)}\nurl: https://example.com\nasOf: 2026-06-01\n${calendars}`;
}

/** Dates, derived values and history: the optional data #530, #533 and #536 name. */
const EXTRA = [
  "    dates: [released]",
  "    derived:",
  "      daysLeft: { field: released, kind: days-left }",
  "      state:",
  "        field: released",
  "        bands:",
  "          - { below: 0, value: expired }",
  "          - { below: 30, value: soon }",
  "          - { value: later }",
  "    changelog:",
  "      track: [status]",
].join("\n");

/** One calendar over the dated record, so the record page has an address and a file. */
const CALENDARS = [
  "calendars:",
  "  items:",
  "    collection: items",
  "    events:",
  "      - name: due",
  "        field: released",
  '        title: "{title} is due"',
].join("\n");

/** The review lock makes `guide.md` stale: the fixture never marked the file it covers. */
const LOCK = `${JSON.stringify({ version: 1, pages: {} }, null, 2)}\n`;

let extended: BuiltSite;
let without: BuiltSite;

before(() => {
  extended = build("data-site", process.env, {
    "mizzen.yml": configWith(EXTRA, CALENDARS),
    "docs-review.lock.json": LOCK,
  });
  // The same site with every optional key left out, so each test can compare the page that does not
  // use the data with the page the engine built before the key existed.
  without = build("data-site", process.env, { "mizzen.yml": configWith("") });
});

after(() => {
  rmSync(extended.out, { recursive: true, force: true });
  rmSync(without.out, { recursive: true, force: true });
});

test("a record without derived values builds the same page (#530)", () => {
  assert.equal(extended.html("/items/plain/"), without.html("/items/plain/"));
  assert.equal(extended.html("/releases/4.0.0/"), without.html("/releases/4.0.0/"));
});

test("a page without a calendar address builds the same page (#533)", () => {
  assert.doesNotMatch(extended.html("/items/plain/"), /calendars\/items\.ics/);
  assert.equal(extended.html("/items/plain/"), without.html("/items/plain/"));

  // The dated record is the positive case: the engine writes a calendar file beside its page.
  assert.match(extended.file("items/dated/calendar.ics"), /BEGIN:VCALENDAR/);
  assert.match(extended.file("items/dated/calendar.ics"), /BEGIN:VEVENT/);
  assert.doesNotMatch(extended.html("/items/plain/"), /calendar\.ics/);
});

test("a record without history events builds the same page (#536)", () => {
  // The engine's own Markdown twin carries the events it gave the page, newest first.
  const dated = extended.file("items/dated/index.md");
  const changed = dated.indexOf("changed dated");
  const added = dated.indexOf("added dated");
  assert.ok(changed !== -1 && added !== -1, "the dated record lists both events");
  assert.ok(changed < added, "the newest event comes first");

  assert.doesNotMatch(extended.file("items/plain/index.md"), /changed dated|added dated/);
  assert.equal(extended.html("/items/plain/"), without.html("/items/plain/"));
});

test("a page without a stale state builds the same page (#540)", () => {
  const guide = JSON.parse(extended.file("guide/index.json")) as { stale?: unknown };
  assert.deepEqual(guide.stale, { files: [{ path: "assets/example.txt", change: "added" }] });

  assert.ok(!("stale" in (JSON.parse(extended.file("components/button/index.json")) as object)));
  assert.equal(extended.html("/components/button/"), without.html("/components/button/"));
  assert.equal(extended.html("/releases/4.0.0/"), without.html("/releases/4.0.0/"));
});
