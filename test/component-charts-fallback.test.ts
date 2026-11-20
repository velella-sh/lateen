import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import charts, { type ChartsProps } from "../components/charts/index.ts";
import { parseRows } from "../components/charts/data.ts";

function render(props: ChartsProps): string {
  const input = { props, page: { lang: "en" }, site: { collections: {} }, html: "" } as unknown as ComponentProps<ChartsProps>;
  return renderToString(charts(input) as never);
}

/** The payload the island reads, exactly as the browser parses it. */
function payload(html: string): string {
  const match = html.match(/<script type="application\/json" data-chart-data="true">([\s\S]*?)<\/script>/);
  assert.ok(match, "the server embeds the chart data");
  return match[1]!;
}

function table(html: string): { label: string; value: string }[] {
  return [...html.matchAll(/<th scope="row">([^<]*)<\/th><td>([^<]*)<\/td>/g)].map((match) => ({ label: match[1]!, value: match[2]! }));
}

const MIXED = [
  { label: " Install ", value: 12 },
  { label: "Zero", value: 0 },
  { label: "Negative", value: -5 },
  { label: "Decimal", value: "4.5" },
  { label: "Missing value" },
  { label: "", value: 9 },
  { label: "Not a number", value: "many" },
  null,
  [],
  7,
];

test("the server table, the bar fallback, and the island read one normalized model", () => {
  const html = render({ title: "Counts", rows: JSON.stringify(MIXED) });
  const model = parseRows(JSON.stringify(MIXED));
  assert.deepEqual(model, [
    { label: "Install", value: 12 },
    { label: "Zero", value: 0 },
    { label: "Negative", value: -5 },
    { label: "Decimal", value: 4.5 },
  ]);

  assert.deepEqual(table(html), model.map((row) => ({ label: row.label, value: String(row.value) })));

  const bars = [...html.matchAll(/<i style="height:(-?\d+)%" title="([^"]*)"><\/i>/g)];
  const max = Math.max(...model.map((row) => row.value), 1);
  assert.deepEqual(
    bars.map((match) => ({ height: match[1], title: match[2] })),
    model.map((row) => ({ height: String(Math.round((row.value / max) * 100)), title: `${row.label}: ${row.value}` })),
  );

  for (const row of model) {
    assert.ok(html.includes(`${row.label} ${row.value}`), `the canvas label names ${row.label} ${row.value}`);
  }

  const client = parseRows(payload(html));
  assert.deepEqual(client, model, "the island sees the same values and labels the server rendered");
  assert.deepEqual(parseRows(JSON.stringify(client)), client, "re-normalizing the payload changes nothing");
});

test("rows with no valid label or value are left out of every rendering", () => {
  const html = render({ rows: JSON.stringify([{ label: "Only", value: 5 }, { label: "Gone", value: null }, { label: 3, value: 4 }]) });
  assert.deepEqual(parseRows(payload(html)), [{ label: "Only", value: 5 }]);
  assert.deepEqual(table(html), [{ label: "Only", value: "5" }]);
  assert.equal([...html.matchAll(/<i /g)].length, 1);
});

test("a malformed or empty payload falls back to the default chart in the server and the island alike", () => {
  for (const rows of ["", "not json", "{}", "null"]) {
    const html = render({ rows });
    const model = parseRows(payload(html));
    assert.equal(model.length, 4);
    assert.deepEqual(table(html), model.map((row) => ({ label: row.label, value: String(row.value) })));
  }
});
