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

/**
 * A duplicate-heavy fixture whose every URL read is counted. Building occurrence keys by rescanning
 * the rows before each result would read URLs quadratically; the one-map count reads each row's URL
 * a fixed number of times, so the read count is the linear-work proof, independent of machine speed.
 */
function countedRecords(count: number, urls: readonly string[]): { records: SearchRecord[]; reads: () => number } {
  let reads = 0;
  const records: SearchRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const url = urls[index % urls.length] ?? "";
    records.push({
      get url(): string {
        reads += 1;
        return url;
      },
      excerpt: "",
    });
  }
  return { records, reads: () => reads };
}

test("a large duplicate-heavy list keeps stable occurrence keys and does linear work", () => {
  const urls = ["/a/", "/b/", "/c/"];
  const size = 4000;
  const first = countedRecords(size, urls);
  const list = optionList(first.records, []);

  // Every copy of a URL keeps its own occurrence, in row order, under its own positional id.
  const occurrences = new Map<string, number>();
  list.rows.forEach((row, index) => {
    const url = urls[index % urls.length] ?? "";
    const occurrence = occurrences.get(url) ?? 0;
    occurrences.set(url, occurrence + 1);
    assert.equal(row.key, resultKey(url, occurrence));
    assert.equal(row.id, optionId(index));
  });
  assert.equal(new Set(list.rows.map((row) => row.key)).size, size, "no key is shared");

  // Linear work: a fixed number of URL reads per row, and doubling the rows doubles the reads.
  // A rescan of prior rows would read about size²/2 URLs instead of a small multiple of size.
  const reads = first.reads();
  assert.ok(reads <= 12 * size, `URL reads (${reads}) stay a small multiple of the row count (${size})`);
  const doubled = countedRecords(size * 2, urls);
  optionList(doubled.records, []);
  assert.ok(doubled.reads() <= 2.5 * reads, "twice the rows costs about twice the work, not four times");

  // A redraw of the same query gives the same keys, so a remembered duplicate resolves again.
  const second = countedRecords(size, urls);
  const redrawn = optionList(second.records, []);
  assert.deepEqual(
    redrawn.rows.map((row) => row.key),
    list.rows.map((row) => row.key),
  );
  assert.equal(activeIndexOf(redrawn.rows, list.rows[size - 1]?.key), size - 1);
});

test("many actions sharing one id keep occurrence keys in linear time too", () => {
  const size = 4000;
  const actions = Array.from({ length: size }, () => action("copy"));
  const list = optionList([], actions, {}, { question: "how do caches work", label: "Ask" });
  list.rows.slice(0, size).forEach((row, index) => {
    assert.equal(row.key, actionKey("copy", index));
    assert.equal(row.id, optionId(index));
  });
  assert.equal(list.rows[size]?.key, askKey("how do caches work", 0));
  assert.equal(new Set(list.rows.map((row) => row.key)).size, size + 1);
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