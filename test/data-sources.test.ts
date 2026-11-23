import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { all, build, type BuiltSite } from "./integration-helpers.ts";

/**
 * Verifies the data sources Mizzen 0.2.5 added (a paginated https API, a SQLite query, an NDJSON file)
 * against the theme's provenance panel, raw-data links and edit link. The lock and the `.mizzen/data/`
 * store are written here, by hand, in the shapes `mizzen data fetch` and `mizzen data extract` write, so
 * nothing touches the network or a database.
 */

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const API_URL = "https://api.example.test/v1/items";
const apiRecords = [
  { id: "a1", name: "First item" },
  { id: "a2", name: "Second item" },
  { id: "a3", name: "Third item" },
];
const apiText = `${JSON.stringify(apiRecords, null, 2)}\n`;
const apiPages = [
  `{"records":[{"id":"a1","name":"First item"},{"id":"a2","name":"Second item"}],"pagination":{"page":1,"pages":2}}`,
  `{"records":[{"id":"a3","name":"Third item"}],"pagination":{"page":2,"pages":2}}`,
];

const rows = [
  { id: "c1", name: "Anchor", price: 12 },
  { id: "c2", name: "Rope", price: 7 },
];
const catalogText = `${rows.map(canonical).join("\n")}\n`;
const eventRows = [
  { id: "e1", name: "Deploy started" },
  { id: "e2", name: "Deploy finished" },
];
const eventsText = `${eventRows.map(canonical).join("\n")}\n`;

/** The pins `mizzen data extract` writes for the `catalog` and `events` collections. */
function extraction(source: string, query: string, text: string, records: number, querySha256: string) {
  return { source, query, querySha256, bytes: Buffer.byteLength(text), sha256: sha(text), records };
}

const lock = {
  version: 1,
  sources: {
    [API_URL]: {
      address: API_URL,
      bytes: Buffer.byteLength(apiText),
      sha256: sha(apiText),
      fetchedAt: "2026-05-01T12:00:00Z",
      pages: apiPages.map((body, index) => ({
        url: index === 0 ? API_URL : `${API_URL}?page=2`,
        bytes: Buffer.byteLength(body),
        sha256: sha(body),
      })),
    },
  },
  snapshots: {
    api: { source: API_URL, capturedAt: "2026-05-01T12:00:00Z", tool: "mizzen", toolVersion: "0.2.5" },
    catalog: { source: "_data/catalog.sqlite", capturedAt: "2026-05-02", tool: "sqlite", toolVersion: "3.46.0" },
    events: { source: "_data/events.ndjson", capturedAt: "2026-05-03", tool: "mizzen", toolVersion: "0.2.5" },
  },
  extractions: {
    catalog: extraction(
      "_data/catalog.sqlite",
      "catalog",
      catalogText,
      rows.length,
      sha(JSON.stringify({ kind: "sqlite", query: "SELECT id, name, price FROM items", params: [], key: "id", order: [], binary: "base64" })),
    ),
    events: extraction("_data/events.ndjson", "ndjson", eventsText, eventRows.length, sha(JSON.stringify({ kind: "ndjson", id: "id" }))),
  },
};

const files: Record<string, string> = {
  "mizzen.lock.json": `${canonical(lock)}\n`,
  [`.mizzen/data/${sha(apiText)}`]: apiText,
  [`.mizzen/data/${sha(catalogText)}`]: catalogText,
  [`.mizzen/data/${sha(eventsText)}`]: eventsText,
};

let site: BuiltSite | undefined;
function built(): BuiltSite {
  site ??= build("data-sources", process.env, files);
  return site;
}

const panel = (page: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const dl of all(built().document(page), ".snapshot-panel dl")) {
    const children = [...dl.children];
    for (let i = 0; i < children.length; i += 2) found.set(children[i]!.textContent ?? "", children[i + 1]?.textContent ?? "");
  }
  return found;
};

const SOURCES = [
  { name: "api", record: "/api/a1/", list: "/api/" },
  { name: "catalog", record: "/catalog/c1/", list: "/catalog/" },
  { name: "events", record: "/events/e1/", list: "/events/" },
] as const;

test("every source type builds from its hand-written lock and store", () => {
  for (const { record, list } of SOURCES) {
    assert.equal(all(built().document(record), "article.record").length, 1, record);
    assert.ok(all(built().document(list), "table tbody tr, .cards > *").length >= 2, `${list} lists its records`);
  }
  assert.ok(all(built().document("/api/a3/"), "article.record").length === 1, "the second API page's record is built");
});

test("the snapshot panel reads sensibly for each source type", () => {
  const api = panel("/api/a1/");
  assert.equal(api.get("Source"), API_URL);
  assert.equal(api.get("Tool"), "mizzen");
  assert.equal(api.has("Revision"), false, "an API has no revision, so no empty row");
  const catalog = panel("/catalog/c1/");
  assert.equal(catalog.get("Source"), "_data/catalog.sqlite");
  assert.equal(catalog.get("Tool version"), "3.46.0");
  const events = panel("/events/e1/");
  assert.equal(events.get("Source"), "_data/events.ndjson");
  for (const { record, list } of SOURCES) {
    assert.deepEqual([...panel(record).keys()], [...panel(list).keys()], `${record} and ${list} show the same rows`);
  }
});

test("raw data links name the collection and exist in the output", () => {
  for (const { name, record, list } of SOURCES) {
    for (const page of [record, list]) {
      const hrefs = all(built().document(page), "a[download]").map((a) => a.getAttribute("href"));
      assert.deepEqual(hrefs, [`/data/${name}.raw.json`, `/data/${name}.csv`, `/data/${name}.sha256`], page);
    }
    for (const href of [`data/${name}.raw.json`, `data/${name}.csv`]) assert.doesNotThrow(() => built().file(href), href);
  }
});

/** The text the page's report link and edit prompt name as the record's data: the places a data file is offered. */
function dataPointers(page: string): { prompt: string | undefined; data: string | undefined; edit: (string | null)[] } {
  const doc = built().document(page);
  const prompt = all(doc, "[data-prompt]")[0]?.getAttribute("data-prompt") ?? undefined;
  const report = all(doc, "a[href*='/issues/new']")[0]?.getAttribute("href");
  const body = report === undefined || report === null ? undefined : new URL(report).searchParams.get("body") ?? undefined;
  return {
    prompt,
    data: body?.split("\n").find((line) => line.startsWith("Data: ")),
    edit: all(doc, "[data-edit-page] a").map((a) => a.getAttribute("href")),
  };
}

test("a record is never pointed at the stored copy, a database or a URL as a file to edit", () => {
  for (const { record } of SOURCES) {
    const { prompt, data, edit } = dataPointers(record);
    for (const text of [prompt ?? "", data ?? "", ...edit.map(String)]) {
      assert.doesNotMatch(text, /\.mizzen|[0-9a-f]{64}/, `${record}: ${text}`);
    }
    assert.doesNotMatch(data ?? "", /\]\(|blob\//, `${record}: only a file at a known line is linked`);
  }
});

test("the NDJSON source is editable as a file, without the stored copy's line number", () => {
  const { prompt, data } = dataPointers("/events/e1/");
  assert.match(prompt ?? "", /^Edit _data\/events\.ndjson\. /);
  assert.equal(data, "Data: _data/events.ndjson");
});

test("a SQLite or API record offers no edit prompt, and the report names where the data came from", () => {
  const catalog = dataPointers("/catalog/c1/");
  assert.equal(catalog.prompt, undefined, "no 'edit' button for a database row");
  assert.equal(catalog.data, "Data: _data/catalog.sqlite");
  const api = dataPointers("/api/a1/");
  assert.equal(api.prompt, undefined);
  assert.equal(api.data, `Data: ${API_URL}`);
});

test("a record from a plain data file still links its file and lines", () => {
  const { prompt, data } = dataPointers("/notes/n1/");
  assert.match(prompt ?? "", /^Edit _data\/notes\.json:\d+\. /);
  assert.match(data ?? "", /^Data: \[_data\/notes\.json:\d+\]\(https:\/\/github\.com\/example\/docs\/blob\/main\/_data\/notes\.json#L\d+\)$/);
});
