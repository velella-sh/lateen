import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, { type BarChartProps } from "../components/bar-chart/index.ts";
import chartData, {
  NO_VALUE_TEXT,
  TABLE_CLASS,
  type ChartDataProps,
} from "../components/chart-data/index.ts";
import chartDownloads, {
  CSV_TYPE,
  DOWNLOAD_CLASS,
  DOWNLOAD_LABEL,
  JSON_TYPE,
  csvOf,
  downloadsOf,
  fileNameOf,
} from "../components/chart-data/download.ts";
import { formatNumber } from "../src/report.ts";

const PROPS: ChartDataProps = {
  id: "quarterly-users",
  title: "Users by quarter",
  description: "Users in each quarter of the year.",
  labelHeading: "Category",
  columns: ["Users"],
  rows: [
    { id: "q1", label: "Q1", values: [1200] },
    { id: "q2", label: "Q2", values: [0] },
    { id: "q3", label: "Q3", values: [-5] },
    { id: "q4", label: "Q4", values: [undefined] },
  ],
  lang: "en",
};

function render(overrides: Partial<ChartDataProps> = {}): string {
  return renderToString(chartData({ ...PROPS, ...overrides }) as never);
}

function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

function hrefOf(tag: string): string {
  const href = tag.match(/href="([^"]*)"/)?.[1];
  assert.ok(href, `link has no href: ${tag}`);
  return href;
}

/** The bytes a link carries, decoded from its data URI. */
function fileOf(tag: string): string {
  const href = hrefOf(tag);
  const comma = href.indexOf(",");
  assert.ok(comma > 0, `not a data URI: ${href}`);
  return decodeURIComponent(href.slice(comma + 1));
}

/** The table as rows of cell text, header included. */
function tableOf(html: string): string[][] {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => cell[1]!),
  );
}

/** A small RFC 4180 reader, enough to compare the file with the table. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rawCell(value: string | number | undefined): string {
  return value === undefined ? "" : String(value);
}

test("the chart offers a CSV and a JSON link, named from its id and grouped for a screen reader", () => {
  const html = render();
  assert.match(html, new RegExp(`<nav class="${DOWNLOAD_CLASS}" aria-label="${DOWNLOAD_LABEL}">`));

  const anchors = links(html);
  assert.equal(anchors.length, 2);

  const csv = anchors.find((tag) => tag.includes('download="quarterly-users.csv"'));
  const json = anchors.find((tag) => tag.includes('download="quarterly-users.json"'));
  assert.ok(csv, "no CSV link");
  assert.ok(json, "no JSON link");
  assert.ok(hrefOf(csv).startsWith(`data:${CSV_TYPE},`), hrefOf(csv));
  assert.ok(hrefOf(json).startsWith(`data:${JSON_TYPE},`), hrefOf(json));
  assert.match(html, />Download CSV<\/a>/);
  assert.match(html, />Download JSON<\/a>/);
  assert.match(csv, /aria-label="Download CSV: Users by quarter"/);

  const other = downloadsOf({ ...PROPS, id: "sales 2026" });
  assert.deepEqual(
    other.map((file) => file.fileName),
    ["sales-2026.csv", "sales-2026.json"],
  );
});

test("the CSV link carries the table's headings and rows, in the table's order", () => {
  const html = render();
  const table = tableOf(html);
  const csv = parseCsv(fileOf(links(html).find((tag) => tag.includes('download="quarterly-users.csv'))!));

  assert.deepEqual(csv[0], table[0]);
  assert.equal(csv.length, table.length);
  PROPS.rows.forEach((row, index) => {
    assert.deepEqual(csv[index + 1], [row.label, ...row.values.map(rawCell)]);
    assert.deepEqual(table[index + 1], [
      row.label,
      ...row.values.map((value) =>
        typeof value === "number" ? formatNumber(PROPS.lang, value) : (value ?? NO_VALUE_TEXT),
      ),
    ]);
  });
});

test("the JSON link carries one object per table row, with raw values and null for no value", () => {
  const html = render();
  const table = tableOf(html);
  const records = JSON.parse(
    fileOf(links(html).find((tag) => tag.includes('download="quarterly-users.json'))!),
  ) as Record<string, string | number | null>[];

  assert.equal(records.length, PROPS.rows.length);
  assert.deepEqual(Object.keys(records[0]!), [PROPS.labelHeading, ...PROPS.columns]);
  PROPS.rows.forEach((row, index) => {
    assert.equal(records[index]?.[PROPS.labelHeading], row.label);
    row.values.forEach((value, column) => {
      assert.equal(records[index]?.[PROPS.columns[column]!], value ?? null);
      assert.equal(
        table[index + 1]?.[column + 1],
        typeof value === "number" ? formatNumber(PROPS.lang, value) : (value ?? NO_VALUE_TEXT),
      );
    });
  });
});

test("both files hold several series under the table's headings", () => {
  const html = render({
    columns: ["Users", "Teams"],
    rows: [
      { id: "q1", label: "Q1", values: [1200, 3] },
      { id: "q2", label: "Q2", values: [1, undefined] },
    ],
  });
  const anchors = links(html);
  const csv = parseCsv(fileOf(anchors.find((tag) => tag.includes('download="quarterly-users.csv'))!));
  const records = JSON.parse(
    fileOf(anchors.find((tag) => tag.includes('download="quarterly-users.json'))!),
  ) as Record<string, string | number | null>[];

  assert.deepEqual(csv, [
    ["Category", "Users", "Teams"],
    ["Q1", "1200", "3"],
    ["Q2", "1", ""],
  ]);
  assert.deepEqual(records, [
    { Category: "Q1", Users: 1200, Teams: 3 },
    { Category: "Q2", Users: 1, Teams: null },
  ]);
});

test("the bar chart links its own rows, sorted as the table shows them", () => {
  const input = {
    props: { from: "sales", category: "name", value: "total", title: "Sales" },
    page: { lang: "en" },
    site: {
      collections: {},
      data: {
        sales: [
          { id: "alpha", name: "Alpha", total: 30 },
          { id: "beta", name: "Beta", total: null },
          { id: "gamma", name: "Gamma", total: 0 },
          { id: "delta", name: "Delta", total: -5 },
        ],
      },
    },
    html: "",
  } as unknown as ComponentProps<BarChartProps>;
  const html = renderToString(barChart(input) as never);

  assert.match(html, new RegExp(`class="${TABLE_CLASS}"`));
  assert.match(html, /download="bar-chart-sales.csv"/);
  assert.match(html, /download="bar-chart-sales.json"/);

  const csv = parseCsv(fileOf(links(html).find((tag) => tag.includes('download="bar-chart-sales.csv"'))!));
  assert.deepEqual(csv, [
    ["Category", "Value"],
    ["Alpha", "30"],
    ["Beta", ""],
    ["Gamma", "0"],
    ["Delta", "-5"],
  ]);
  assert.deepEqual(
    tableOf(html).slice(1).map((row) => row[0]),
    csv.slice(1).map((row) => row[0]),
  );
});

test("a CSV field with a comma, a quote, or a line break is quoted and reads back unchanged", () => {
  const csv = csvOf("Label", ["Value"], [{ label: 'One, "quoted"', values: ["a\nb"] }]);
  assert.equal(csv, 'Label,Value\n"One, ""quoted""","a\nb"\n');
  assert.deepEqual(parseCsv(csv), [
    ["Label", "Value"],
    ['One, "quoted"', "a\nb"],
  ]);
});

test("the files are written into the page at build time, not in the browser", () => {
  const html = render();
  assert.doesNotMatch(html, /<script\b/);
  assert.doesNotMatch(html, /\bBlob\b|createObjectURL|\bfetch\(|document\./);

  const source = readFileSync(
    new URL("../components/chart-data/download.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bBlob\b|createObjectURL|\bfetch\(|document\./);
});

test("a table without a chart id offers no downloads and keeps its own name", () => {
  const { id: _id, ...withoutId } = PROPS;
  const html = renderToString(chartData(withoutId) as never);
  assert.equal(links(html).length, 0);
  assert.doesNotMatch(html, new RegExp(DOWNLOAD_CLASS));
});

test("a chart-data component can be used on its own and names files from its id", () => {
  const html = renderToString(
    chartDownloads({
      id: PROPS.id!,
      title: PROPS.title,
      labelHeading: PROPS.labelHeading,
      columns: PROPS.columns,
      rows: PROPS.rows,
    }) as never,
  );
  assert.match(html, /download="quarterly-users.csv"/);
  assert.equal(fileNameOf("", "csv"), "chart-data.csv");
});
