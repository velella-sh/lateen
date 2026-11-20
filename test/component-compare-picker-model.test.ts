// The picker's pure model: one record per column in the address's order, the option list in the
// index's order, a named id the index lacks, and the differences computed once per selection.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectionIndex } from "../components/data-explorer/index-loader.ts";
import { optionsOf, rowsOf, selectionOf, type CompareField } from "../components/compare/picker-model.ts";

const index: CollectionIndex = {
  columns: ["id", "title", "pages", "published", "url"],
  rows: [
    ["b", "Beta", 80, "2026-02-27", "/books/b/"],
    ["a", "Alpha", 120, "2026-11-09", "/books/a/"],
    ["c", "Gamma", 200, "2026-06-01", "/books/c/"],
  ],
};

const fields: CompareField[] = [
  { field: "pages", kind: "number" },
  { field: "title", kind: "text" },
];

test("the option list keeps the index's order whatever the address asks for", () => {
  const selection = selectionOf(index, ["c", "a"], [undefined, undefined]);
  assert.deepEqual(
    optionsOf(index).map((option) => option.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(selection.ids, ["c", "a"], "the address's order names the columns");
});

test("a selection maps the address by column and keeps a column it does not name", () => {
  const current = [index.rows[1], index.rows[0]];
  const selection = selectionOf(index, ["c"], current);

  assert.deepEqual(selection.ids, ["c", "b"]);
  assert.deepEqual(
    selection.columns.map((column) => column.row?.[1]),
    ["Gamma", "Beta"],
  );
  assert.deepEqual(
    selection.columns.map((column) => column.missing),
    [undefined, undefined],
  );
});

test("an id the index lacks stays visible as missing and leaves the column's record", () => {
  const selection = selectionOf(index, ["ghost"], [index.rows[1]]);

  assert.deepEqual(selection.ids, ["a"], "the unknown id is never written as a choice");
  assert.equal(selection.columns[0]?.missing, "ghost");
  assert.equal(selection.columns[0]?.row?.[1], "Alpha");
});

test("rows compare numbers by value and lists without their order", () => {
  const listIndex: CollectionIndex = {
    columns: ["id", "title", "tags"],
    rows: [
      ["a", "Alpha", ["one", "two"]],
      ["b", "Beta", ["two", "one"]],
    ],
  };
  const selection = selectionOf(listIndex, [], listIndex.rows);
  const [tags] = rowsOf(listIndex, selection.columns, [{ field: "tags", kind: "list" }]);
  assert.equal(tags?.differs, false);

  const numberIndex: CollectionIndex = {
    columns: ["id", "title", "pages"],
    rows: [
      ["a", "Alpha", 120],
      ["b", "Beta", "120.0"],
    ],
  };
  const [numbers] = rowsOf(
    numberIndex,
    selectionOf(numberIndex, [], numberIndex.rows).columns,
    [{ field: "pages", kind: "number" }],
  );
  assert.equal(numbers?.differs, false, "120 and 120.0 are the same number");

  const [chosen] = rowsOf(index, selectionOf(index, ["a", "c"], [undefined, undefined]).columns, fields.slice(0, 1));
  assert.deepEqual(chosen?.values, [120, 200]);
  assert.equal(chosen?.differs, true);
});

test("a missing value differs, and a row without a record or field is left unavailable", () => {
  const withEmpty: CollectionIndex = {
    columns: ["id", "title", "pages", "url"],
    rows: [
      ["a", "Alpha", 120, "/books/a/"],
      ["b", "Beta", "", "/books/b/"],
    ],
  };
  const selection = selectionOf(withEmpty, [], withEmpty.rows);
  const [pages] = rowsOf(withEmpty, selection.columns, [{ field: "pages", kind: "number" }]);
  assert.equal(pages?.differs, true);

  const noRecord = rowsOf(index, selectionOf(index, [], [undefined, index.rows[0]]).columns, fields);
  assert.ok(noRecord.every((row) => row.available === false));

  const noField = rowsOf(index, selectionOf(index, [], index.rows.slice(0, 2)).columns, [
    { field: "isbn", kind: "text" },
  ]);
  assert.deepEqual(noField, [
    { field: { field: "isbn", kind: "text" }, values: [], differs: false, available: false },
  ]);
});
