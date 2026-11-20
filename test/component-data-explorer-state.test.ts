// The explorer's query state without a browser: the address, the facets, the rows a query leaves,
// the page it shows, and the active-row transitions. `client.ts` applies what these functions return.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectionIndex } from "../components/data-explorer/index-loader.ts";
import {
  buildFacets,
  createModel,
  enterTarget,
  facetCounts,
  hasMore,
  hasState,
  matchingRows,
  nextActive,
  pageRows,
  readAddress,
  sortOf,
  sortValue,
  writeAddress,
  type Facet,
  type Selection,
} from "../components/data-explorer/state.ts";

const index: CollectionIndex = {
  columns: ["title", "shelf", "year", "format", "url"],
  rows: [
    ["Book 0", "fiction", 2020, "paper", "/books/b0/"],
    ["Book 1", "fiction", 2020, "paper", "/books/b1/"],
    ["Book 2", "fiction", 2021, "paper", "/books/b2/"],
    ["Book 3", "history", 2021, "paper", "/books/b3/"],
    ["Book 4", "history", 2021, "paper", "/books/b4/"],
    ["Book 5", "reference", 2022, "paper", "/books/b5/"],
  ],
};

const columns = [
  { field: "title", kind: "text", label: "Title" },
  { field: "shelf", kind: "text", label: "Shelf" },
  { field: "year", kind: "number", label: "Year" },
];

const sortables = [
  { field: "title", kind: "text", label: "Title" },
  { field: "year", kind: "number", label: "Year" },
];

// `format` holds one value, so the page offers no facet for it.
const model = createModel(index, columns, ["shelf", "year", "format"], "en");

/** A selection with the named filters and an optional `field:direction` sort. */
const selectionOf = (
  query = "",
  filters: readonly (readonly [string, string[]])[] = [],
  sort?: string,
): Selection => ({
  query,
  filters: new Map(filters),
  sort: sort === undefined ? undefined : sortOf(sort, sortables),
});

const titles = (selection: Selection): string[] => matchingRows(model, selection).map((row) => String(row[0]));

const valuesOf = (facets: readonly Facet[], field: string): Map<string, number> =>
  new Map(facets.find((facet) => facet.field === field)!.values.map((value) => [value.raw, value.count]));

test("the address names the query, every filter, and the order", () => {
  const selection = readAddress(
    "?q=book&filter.shelf=fiction&filter.shelf=history&filter.collection=books&sort=year&order=desc",
    sortables,
  );

  assert.equal(selection.query, "book");
  assert.deepEqual([...(selection.filters.get("shelf") ?? [])], ["fiction", "history"]);
  assert.equal(selection.filters.has("collection"), false, "the search page's own filter is not the explorer's");
  assert.deepEqual(selection.sort, { field: "year", kind: "number", direction: "descending" });
  assert.equal(sortValue(selection.sort), "year:descending");
  assert.equal(readAddress("?sort=year", sortables).sort, undefined, "an order the page lacks reads as relevance");
  assert.equal(readAddress("?sort=missing&order=asc", sortables).sort, undefined);
});

test("writing the address replaces only the explorer's keys and drops a value the index lacks", () => {
  const selection = selectionOf("  new  ", [["shelf", ["fiction", "reference", "nope"]]], "year:ascending");
  const written = new URL(
    writeAddress(
      "https://example.test/books/?q=old&filter.shelf=fiction&filter.collection=books&page=2#top",
      selection,
      model.facets,
    ),
  );

  assert.equal(written.searchParams.get("q"), "new", "the query is trimmed");
  assert.deepEqual(written.searchParams.getAll("filter.shelf"), ["fiction", "reference"]);
  assert.equal(written.searchParams.get("filter.collection"), null, "every `filter.` key belongs to the explorer");
  assert.equal(written.searchParams.get("page"), "2");
  assert.equal(written.searchParams.get("sort"), "year");
  assert.equal(written.searchParams.get("order"), "asc");
  assert.equal(written.hash, "#top");

  assert.equal(
    new URL(writeAddress(written.toString(), selectionOf("", [["shelf", ["fiction"]]]), model.facets))
      .searchParams.get("sort"),
    null,
    "clearing the sort clears the order too",
  );
});

test("the facets keep only fields with two values", () => {
  assert.deepEqual(buildFacets(index, columns, ["shelf", "year", "format"], "en").map((facet) => facet.field), [
    "shelf",
    "year",
  ]);
  assert.deepEqual(buildFacets(index, columns, ["missing"], "en"), []);
});

test("the query, every chosen facet, and the sort decide the rows", () => {
  assert.deepEqual(titles(selectionOf("book")), ["Book 0", "Book 1", "Book 2", "Book 3", "Book 4", "Book 5"]);
  assert.deepEqual(titles(selectionOf("book", [["shelf", ["fiction"]]])), ["Book 0", "Book 1", "Book 2"]);
  assert.deepEqual(titles(selectionOf("book", [["shelf", ["fiction"]], ["year", ["2,021"]]])), ["Book 2"]);
  assert.deepEqual(titles(selectionOf("book", [], "year:descending")), [
    "Book 5",
    "Book 2",
    "Book 3",
    "Book 4",
    "Book 0",
    "Book 1",
  ]);
  assert.deepEqual(titles(selectionOf("zzz")), []);
});

test("a facet's counts follow the query and the other fields, never its own choice", () => {
  const counts = facetCounts(model, selectionOf("book", [["shelf", ["fiction"]]]));

  assert.deepEqual(
    [...valuesOf(counts, "year")],
    [["2,020", 2], ["2,021", 1], ["2,022", 0]],
    "the query and the shelf filter leave the years",
  );
  assert.deepEqual(
    [...valuesOf(counts, "shelf")],
    [["fiction", 3], ["history", 2], ["reference", 1]],
    "the shelf choice does not narrow its own values",
  );
  assert.deepEqual([...valuesOf(facetCounts(model, selectionOf("zzz")), "year")], [["2,020", 0], ["2,021", 0], ["2,022", 0]]);
});

test("a page ends at the limit, and the button waits while rows remain", () => {
  const rows = matchingRows(model, selectionOf("book"));
  assert.deepEqual(pageRows(rows, 4).map((row) => row[0]), ["Book 0", "Book 1", "Book 2", "Book 3"]);
  assert.equal(pageRows(rows, 50).length, 6);
  assert.equal(hasMore(rows, 4), true);
  assert.equal(hasMore(rows, 6), false);
  assert.equal(hasMore([], 50), false);
});

test("the arrow keys wrap and Enter falls back to the first row", () => {
  assert.equal(nextActive(-1, 11, "ArrowDown"), 0);
  assert.equal(nextActive(10, 11, "ArrowDown"), 0);
  assert.equal(nextActive(0, 11, "ArrowUp"), 10);
  assert.equal(nextActive(3, 11, "ArrowDown"), 4);
  assert.equal(nextActive(-1, 0, "ArrowDown"), -1);
  assert.equal(nextActive(-1, 0, "ArrowUp"), -1);

  assert.equal(enterTarget(-1, 11), 0, "nothing active opens the first row");
  assert.equal(enterTarget(3, 11), 3, "the active row opens");
  assert.equal(enterTarget(20, 11), 0, "a mark past the list opens the first row");
  assert.equal(enterTarget(-1, 0), -1, "no row keeps the form's own Enter");
});

test("only a query, an offered filter, or a sort counts as state", () => {
  assert.equal(hasState(selectionOf(), model.facets), false);
  assert.equal(hasState(selectionOf("   "), model.facets), false);
  assert.equal(hasState(selectionOf("book"), model.facets), true);
  assert.equal(hasState(selectionOf("", [["shelf", ["fiction"]]]), model.facets), true);
  assert.equal(hasState(selectionOf("", [["shelf", ["nope"]]]), model.facets), false, "a value the index lacks is no state");
  assert.equal(hasState(selectionOf("", [], "title:ascending"), model.facets), true);
});
