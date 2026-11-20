import assert from "node:assert/strict";
import { test } from "node:test";
import { CSV_TYPE, JSON_TYPE } from "../components/chart-data/download.ts";
import {
  VARIANTS,
  fileOf,
  hrefOf,
  links,
  parseCsv,
  renderVariant,
  tableOf,
} from "./support-chart-variants.ts";

test("every chart is a component that answers its own directive and id prefix", () => {
  for (const variant of VARIANTS) {
    assert.equal(typeof variant.component, "function", variant.name);
    assert.equal(variant.directive, variant.prefix, variant.name);
  }
});

test("every chart names its SVG, its caption, and its table from the title and the source", () => {
  for (const variant of VARIANTS) {
    const html = renderVariant(variant, { title: "Sales" });
    const id = `${variant.prefix}-sales`;
    assert.match(html, /role="img"/, variant.name);
    assert.match(html, new RegExp(`aria-labelledby="${id}-title"`), variant.name);
    assert.match(
      html,
      new RegExp(`<svg class="${variant.prefix}-svg" viewBox="0 0 \\d+ \\d+" role="img" aria-labelledby="${id}-title"`),
      variant.name,
    );
    assert.match(html, new RegExp(`<title id="${id}-title">Sales</title>`), variant.name);
    assert.match(html, new RegExp(`<caption>Sales</caption>`), variant.name);
    assert.match(html, new RegExp(`<table class="${variant.tableClass}">`), variant.name);
    assert.equal(
      (html.match(/<th scope="row">/g) ?? []).length,
      variant.rowCount,
      `${variant.name} keeps every row in the table`,
    );
    assert.doesNotMatch(html, /<script/, variant.name);
  }
});

test("every chart that can download links its table's rows as a CSV and a JSON file", () => {
  for (const variant of VARIANTS.filter((item) => item.download)) {
    const html = renderVariant(variant, { title: "Sales" });
    const id = `${variant.prefix}-sales`;
    const anchors = links(html);
    const csv = anchors.find((tag) => tag.includes(`download="${id}.csv"`));
    const json = anchors.find((tag) => tag.includes(`download="${id}.json"`));
    assert.ok(csv, `${variant.name} has no CSV link`);
    assert.ok(json, `${variant.name} has no JSON link`);
    assert.ok(csv.includes(`aria-label="Download CSV: Sales"`), variant.name);
    assert.ok(hrefOf(csv).startsWith(`data:${CSV_TYPE},`), variant.name);
    assert.ok(hrefOf(json).startsWith(`data:${JSON_TYPE},`), variant.name);

    const table = tableOf(html);
    const parsedCsv = parseCsv(fileOf(csv));
    assert.deepEqual(parsedCsv[0], table[0], `${variant.name} CSV headings match the table`);
    assert.deepEqual(
      parsedCsv.slice(1).map((row) => row[0]),
      table.slice(1).map((row) => row[0]),
      `${variant.name} CSV rows are in the table's order`,
    );

    const records = JSON.parse(fileOf(json)) as Record<string, string | number | null>[];
    assert.equal(records.length, table.length - 1, variant.name);
    assert.deepEqual(Object.keys(records[0]!), table[0], `${variant.name} JSON keys match the table`);
    assert.deepEqual(
      records.map((record) => record[table[0]![0]!]),
      table.slice(1).map((row) => row[0]),
      `${variant.name} JSON rows are in the table's order and keep raw values`,
    );
  }
});

test("every chart shows a note for a missing source, an empty source, and no source at all", () => {
  const cases = [
    { name: "missing", props: { from: "unknown" }, site: { data: {}, collections: {} }, mentions: "unknown" },
    { name: "empty", props: {}, site: { data: { sales: [] }, collections: {} } },
    { name: "unnamed", props: { from: undefined }, site: { data: {} } },
  ] as const;
  for (const variant of VARIANTS) {
    for (const item of cases) {
      const html = renderVariant(variant, item.props, item.site);
      assert.match(html, new RegExp(`class="${variant.missingClass}"`), `${variant.name}: ${item.name}`);
      if ("mentions" in item) {
        assert.ok(html.includes(item.mentions), `${variant.name}: ${item.name} names the source`);
      }
    }
  }
});

test("every chart with the same source draws its axis from zero to the data's range", () => {
  const site = { data: { sales: [{ id: "a", name: "A", quarter: "Q1", region: "North", month: 1, total: 30 }, { id: "b", name: "B", quarter: "Q2", region: "South", month: 2, total: 12 }] }, collections: {} };
  for (const variant of VARIANTS) {
    const html = renderVariant(variant, {}, site);
    if (variant.fromZero) {
      assert.match(html, new RegExp(`class="${variant.prefix}-tick"[^>]*>0<`), `${variant.name} shows zero`);
    }
    assert.match(html, new RegExp(`class="${variant.prefix}-tick"[^>]*>30<`), `${variant.name} reaches the top value`);
  }
});
