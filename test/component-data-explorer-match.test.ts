import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectionIndex } from "../components/data-explorer/index-loader.ts";
import { matchRows, normalize, prepareRows } from "../components/data-explorer/match.ts";

/** Twelve records with Latin, Persian, and Arabic text, and aliases in every script. */
const books: CollectionIndex = {
  columns: ["title", "author", "aka", "url"],
  rows: [
    ["Tidal", "Ada", "", "/b0/"],
    ["Tidal Charts", "Bo", ["tides"], "/b1/"],
    ["Tides of the Sea", "Cy", [], "/b2/"],
    ["The Tidal Chart", "Dee", "", "/b3/"],
    ["Charting Tides", "Eve", ["tidal-wave"], "/b4/"],
    ["کتاب tides", "Farnaz", ["کتب"], "/b5/"],
    ["آب و هوا", "Golnaz", ["weather"], "/b6/"],
    ["مدينة", "Hoda", ["city"], "/b7/"],
    ["Tidbit", "Tidal", "", "/b8/"],
    ["Riding the Tide", "Ida", ["tid"], "/b9/"],
    ["می‌رود", "Jamshid", "", "/b10/"],
    ["سال ۱۴۰۲", "Kimia", "", "/b11/"],
  ],
};

// The alias column is searched even though no table column shows it.
const search = prepareRows(books, ["title", "author"], "aka");

/** The URLs of a query's matches, in rank order. */
const urls = (query: string): string[] => matchRows(search, query).map((row) => String(row[3]));

test("normalization folds case, diacritics, letter forms, digits, and word boundaries", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["Café", "cafe"],
    ["İstanbul", "istanbul"],
    ["ﬁle", "file"],
    ["TIDAL", "tidal"],
    ["كِتَاب", "کتاب"],
    ["أحمد إبراهيم آدم ٱلله", "احمد ابراهیم ادم الله"],
    ["مصطفى علي", "مصطفی علی"],
    ["خانۀ", "خانه"],
    ["مدينة", "مدینه"],
    ["مؤمن", "مومن"],
    ["کــتاب", "کتاب"],
    ["۱۲۳ ٤٥٦", "123 456"],
    ["می‌رود، خوب!", "می رود خوب"],
    ["  Tidal---Charts  ", "tidal charts"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalize(input), expected, JSON.stringify(input));
  }
});

test("a token matches a word's start, never its middle", () => {
  assert.deepEqual(urls("idal"), []);
  assert.deepEqual(urls("ides"), []);
  assert.deepEqual(urls("tidalx"), []);
});

test("every token must match, in any field and in any order", () => {
  assert.deepEqual(urls("ada tidal"), ["/b0/"]);
  assert.deepEqual(urls("tidal ada"), ["/b0/"]);
  assert.deepEqual(urls("tides farnaz"), ["/b5/"]);
  assert.deepEqual(urls("tidal farnaz"), []);
});

test("other names match even though the table never shows them", () => {
  assert.deepEqual(urls("city"), ["/b7/"]);
  assert.deepEqual(urls("wave"), ["/b4/"]);
  assert.deepEqual(urls("weather"), ["/b6/"]);
  assert.deepEqual(urls("کتب"), ["/b5/"]);
});

test("an empty query matches every row in source order, and equal rows keep their order", () => {
  const all = books.rows.map((row) => String(row[3]));
  assert.deepEqual(urls(""), all);
  assert.deepEqual(urls("   "), all);

  const ties: CollectionIndex = {
    columns: ["title", "url"],
    rows: [
      ["Tidal", "/t0/"],
      ["Tidal", "/t1/"],
      ["Tidal", "/t2/"],
    ],
  };
  const prepared = prepareRows(ties, ["title"]);
  assert.deepEqual(
    matchRows(prepared, "tidal").map((row) => String(row[1])),
    ["/t0/", "/t1/", "/t2/"],
  );
});

test("mixed scripts and digit sets match the same record", () => {
  const mixed: CollectionIndex = {
    columns: ["title", "url"],
    rows: [["كتاب ١٤٠٢ Tides", "/m/"]],
  };
  const prepared = prepareRows(mixed, ["title"]);
  assert.equal(matchRows(prepared, "کتاب 1402 tid").length, 1);
  assert.equal(matchRows(prepared, "كتاب ۱۴۰۲ tide").length, 1);
  assert.equal(matchRows(prepared, "کتاب 1402 chart").length, 0);
});

test("a collection without a title ranks exact first and keeps source order", () => {
  const names: CollectionIndex = {
    columns: ["name", "aka", "url"],
    rows: [
      ["Charting Tides", "", "/n0/"],
      ["Tide", "", "/n1/"],
      ["Tidbit", "tide", "/n2/"],
    ],
  };
  const prepared = prepareRows(names, ["name"], "aka");
  const found = (query: string): string[] => matchRows(prepared, query).map((row) => String(row[2]));

  assert.deepEqual(found("tide"), ["/n1/", "/n2/", "/n0/"]);
  assert.deepEqual(found("tid"), ["/n0/", "/n1/", "/n2/"]);
});

test("ranking: exact, then title prefix, then the rest, each in source order", () => {
  const ranking: readonly (readonly [string, readonly string[]])[] = [
    ["", ["/b0/", "/b1/", "/b2/", "/b3/", "/b4/", "/b5/", "/b6/", "/b7/", "/b8/", "/b9/", "/b10/", "/b11/"]],
    ["   ", ["/b0/", "/b1/", "/b2/", "/b3/", "/b4/", "/b5/", "/b6/", "/b7/", "/b8/", "/b9/", "/b10/", "/b11/"]],
    ["tidal", ["/b0/", "/b1/", "/b3/", "/b4/", "/b8/"]],
    ["TIDAL", ["/b0/", "/b1/", "/b3/", "/b4/", "/b8/"]],
    ["tid", ["/b9/", "/b0/", "/b1/", "/b2/", "/b3/", "/b4/", "/b5/", "/b8/"]],
    ["tidal chart", ["/b3/", "/b1/", "/b4/"]],
    ["chart tidal", ["/b3/", "/b1/", "/b4/"]],
    ["chart tid", ["/b1/", "/b3/", "/b4/"]],
    ["chart", ["/b3/", "/b1/", "/b4/"]],
    ["charts", ["/b1/"]],
    ["charting", ["/b4/"]],
    ["sea", ["/b2/"]],
    ["of", ["/b2/"]],
    ["tides", ["/b1/", "/b2/", "/b4/", "/b5/"]],
    ["tide", ["/b9/", "/b2/", "/b4/", "/b5/", "/b1/"]],
    ["rid", ["/b9/"]],
    ["tidbi", ["/b8/"]],
    ["tidalx", []],
    ["wave", ["/b4/"]],
    ["ada", ["/b0/"]],
    ["city", ["/b7/"]],
    ["weather", ["/b6/"]],
    ["tidal tides", ["/b1/", "/b4/"]],
    ["tidal tid", ["/b0/", "/b1/", "/b3/", "/b4/", "/b8/"]],
    ["tidal charting", ["/b4/"]],
    ["tidal chart extra", []],
    ["کتاب", ["/b5/"]],
    ["كتاب", ["/b5/"]],
    ["کتب", ["/b5/"]],
    ["مدينه", ["/b7/"]],
    ["آب", ["/b6/"]],
    ["اب", ["/b6/"]],
    ["هوا", ["/b6/"]],
    ["1402", ["/b11/"]],
    ["۱۴۰۲", ["/b11/"]],
    ["١٤٠٢", ["/b11/"]],
    ["tidal-wave", ["/b4/"]],
    ["idal", []],
    ["ides", []],
    ["charting tides", ["/b4/"]],
    ["tidal charts", ["/b1/"]],
    ["ada tidal", ["/b0/"]],
    ["tides farnaz", ["/b5/"]],
    ["می", ["/b10/"]],
    ["رود", ["/b10/"]],
    ["میرود", []],
  ];
  for (const [query, expected] of ranking) {
    assert.deepEqual(urls(query), expected, `query ${JSON.stringify(query)}`);
  }
});
