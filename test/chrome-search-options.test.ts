// The pure option model behind the search dialog, tested against `chrome/search/options.ts` directly:
// grouping, positional ids, duplicate-safe keys, keyboard order, and active-row resolution. The
// client's re-exports must stay the same functions, so its public imports keep working.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PaletteAction } from "../chrome/command-palette/actions.ts";
import {
  ACTIONS_LABEL,
  ASK_HEADING,
  OTHER_SECTION,
  activeIndexOf,
  actionKey,
  askKey,
  groupBySection,
  groupId,
  optionId,
  optionList,
  resultKey,
  safeHref,
  sectionOf,
  wordCount,
  type SearchRecord,
} from "../chrome/search/options.ts";
import { optionList as clientOptionList, safeHref as clientSafeHref } from "../chrome/search/client.ts";

const record = (url: string, section?: string): SearchRecord => ({
  url,
  excerpt: "",
  ...(section === undefined ? {} : { filters: { section: [section] } }),
});

const action = (id: string): PaletteAction => ({ id, label: id });

test("the client re-exports the extracted model unchanged", () => {
  assert.equal(clientOptionList, optionList);
  assert.equal(clientSafeHref, safeHref);
});

test("ids count from one, for rows and group headings alike", () => {
  assert.equal(optionId(0), "search-option-1");
  assert.equal(optionId(2), "search-option-3");
  assert.equal(groupId(0), "search-group-1");
  assert.equal(groupId(1), "search-group-2");
});

test("a missing, empty, or blank section filter reads as Other; a named one is trimmed", () => {
  assert.equal(sectionOf(record("/a/")), OTHER_SECTION);
  assert.equal(sectionOf(record("/a/", "")), OTHER_SECTION);
  assert.equal(sectionOf(record("/a/", "   ")), OTHER_SECTION);
  assert.equal(sectionOf(record("/a/", " Guide ")), "Guide");
});

test("grouping keeps the order each section first appears in and the rank order inside it", () => {
  const groups = groupBySection([record("/g/1", "Guide"), record("/r/1", "Rules"), record("/g/2", "Guide")]);
  assert.deepEqual(
    groups.map((group) => [group.section, group.results.map((result) => result.url)]),
    [
      ["Guide", ["/g/1", "/g/2"]],
      ["Rules", ["/r/1"]],
    ],
  );
});

test("two results for one URL stay two options with distinct ids and occurrence keys", () => {
  const list = optionList([record("/same/"), record("/same/")], []);
  assert.deepEqual(
    list.rows.map((row) => [row.id, row.key]),
    [
      ["search-option-1", resultKey("/same/", 0)],
      ["search-option-2", resultKey("/same/", 1)],
    ],
  );
  assert.notEqual(list.rows[0]?.key, list.rows[1]?.key);
});

test("two actions sharing an id stay two options with distinct ids and occurrence keys", () => {
  const list = optionList([], [action("copy"), action("copy")]);
  assert.deepEqual(
    list.rows.map((row) => [row.id, row.key]),
    [
      ["search-option-1", actionKey("copy", 0)],
      ["search-option-2", actionKey("copy", 1)],
    ],
  );
});

test("the flat row order is the keyboard order: results by section, then actions, then ask", () => {
  const ask = { question: "how do caches work", label: "Ask" };
  const list = optionList([record("/g/1", "Guide"), record("/r/1", "Rules")], [action("theme-dark")], {}, ask);
  assert.deepEqual(
    list.groups.map((group) => group.kind),
    ["result", "result", "action", "ask"],
  );
  assert.deepEqual(
    list.rows.map((row) => row.id),
    ["search-option-1", "search-option-2", "search-option-3", "search-option-4"],
  );
  assert.deepEqual(list.rows, list.groups.flatMap((group) => group.rows));
  assert.equal(list.rows[3]?.key, askKey(ask.question, 0));
});

test("headings default to the English labels and take the page language's names when given", () => {
  const plain = optionList([record("/a/")], [action("copy")], {}, { question: "two words", label: "Ask" });
  assert.deepEqual(
    plain.groups.map((group) => group.heading),
    [OTHER_SECTION, ACTIONS_LABEL, ASK_HEADING],
  );
  const translated = optionList(
    [record("/a/")],
    [action("copy")],
    { otherSection: "Autre", actionsLabel: "Actions fr", askHeading: "Demander" },
    { question: "two words", label: "Ask" },
  );
  assert.deepEqual(
    translated.groups.map((group) => group.heading),
    ["Autre", "Actions fr", "Demander"],
  );
});

test("activeIndexOf resolves a remembered key to its row after a redraw", () => {
  const rows = optionList([record("/a/"), record("/b/")], [action("copy")]).rows;
  assert.equal(activeIndexOf(rows, resultKey("/b/", 0)), 1);
  assert.equal(activeIndexOf(rows, actionKey("copy", 0)), 2);
});

test("activeIndexOf names nothing when the key is absent or the redraw dropped its row", () => {
  const rows = optionList([record("/a/")], []).rows;
  assert.equal(activeIndexOf(rows, undefined), -1);
  assert.equal(activeIndexOf(rows, resultKey("/gone/", 0)), -1);
  assert.equal(activeIndexOf([], resultKey("/a/", 0)), -1);
});

test("a duplicate's occurrence keeps the active row on the second copy across a redraw", () => {
  const before = optionList([record("/same/"), record("/same/")], []).rows;
  const remembered = before[1]?.key;
  const after = optionList([record("/same/"), record("/same/")], []).rows;
  assert.equal(activeIndexOf(after, remembered), 1);
});

test("only followable URLs become links; script and data URLs stay plain text", () => {
  assert.equal(safeHref("/rules/cache/"), "/rules/cache/");
  assert.equal(safeHref("./cache/"), "./cache/");
  assert.equal(safeHref("../cache/"), "../cache/");
  assert.equal(safeHref("HTTPS://example.com/a"), "HTTPS://example.com/a");
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref("data:text/html,<script>alert(1)</script>"), undefined);
  assert.equal(optionList([record("javascript:alert(1)")], []).rows[0]?.href, undefined);
});

test("two typed words make a question; one word or whitespace does not", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   "), 0);
  assert.equal(wordCount("cache"), 1);
  assert.equal(wordCount("  how caches work "), 3);
});