// The chart variants and the render/parsing helpers the shared contracts run against.
// One table per behaviour lives in component-charts-contracts.test.ts.
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import barChart, { directive as barDirective, MISSING_CLASS as BAR_MISSING } from "../components/bar-chart/index.ts";
import { TABLE_CLASS as DATA_TABLE_CLASS } from "../components/chart-data/index.ts";
import lineChart, {
  directive as lineDirective,
  MISSING_CLASS as LINE_MISSING,
} from "../components/line-chart/index.ts";
import stackedBar, { directive as stackedDirective, MISSING_CLASS as STACKED_MISSING } from "../components/stacked-bar/index.ts";

/** The rows every contract reads: a value, a missing value, a zero, and a negative. */
const ROWS = [
  { id: "alpha", name: "Alpha", quarter: "Q1", region: "North", month: 1, total: 30 },
  { id: "beta", name: "Beta", quarter: "Q1", region: "North", month: 2, total: null },
  { id: "gamma", name: "Gamma", quarter: "Q2", region: "South", month: 3, total: 0 },
  { id: "delta", name: "Delta", quarter: "Q2", region: "South", month: 4, total: -5 },
];

const SITE = { data: { sales: ROWS }, collections: {} };

export type ChartVariant = {
  readonly name: string;
  /** The id prefix and the Markdown directive, which are the same word in every chart. */
  readonly prefix: string;
  readonly directive: string;
  readonly component: (input: never) => unknown;
  readonly props: Readonly<Record<string, string>>;
  readonly missingClass: string;
  /** The class on the text alternative: every chart uses the shared chart-data table. */
  readonly tableClass: string;
  /** How many rows the text alternative keeps for the shared fixture. */
  readonly rowCount: number;
  /** Whether the value axis starts at zero. A line chart pads its own range instead. */
  readonly fromZero: boolean;
  readonly download: boolean;
};

export const VARIANTS: readonly ChartVariant[] = [
  {
    name: "bar",
    prefix: "bar-chart",
    directive: barDirective,
    component: barChart as never,
    props: { from: "sales", category: "name", value: "total" },
    missingClass: BAR_MISSING,
    tableClass: DATA_TABLE_CLASS,
    rowCount: 4,
    fromZero: true,
    download: true,
  },
  {
    name: "stacked",
    prefix: "stacked-bar",
    directive: stackedDirective,
    component: stackedBar as never,
    props: { from: "sales", category: "quarter", series: "region", value: "total" },
    missingClass: STACKED_MISSING,
    tableClass: DATA_TABLE_CLASS,
    rowCount: 2,
    fromZero: true,
    download: false,
  },
  {
    name: "line",
    prefix: "line-chart",
    directive: lineDirective,
    component: lineChart as never,
    props: { from: "sales", category: "month", value: "total" },
    missingClass: LINE_MISSING,
    tableClass: DATA_TABLE_CLASS,
    rowCount: 4,
    fromZero: false,
    download: false,
  },
];

/** Render a variant with the shared fixture, or the given props, site, and page. */
export function renderVariant(
  variant: ChartVariant,
  props: Readonly<Record<string, unknown>> = {},
  site: unknown = SITE,
  page: { lang?: string; dir?: string } = {},
): string {
  const input = {
    props: { ...variant.props, ...props },
    page: { lang: "en", ...page },
    site,
    html: "",
  } as unknown as ComponentProps<never>;
  return renderToString(variant.component(input as never) as never);
}

export function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

export function hrefOf(tag: string): string {
  const href = tag.match(/href="([^"]*)"/)?.[1];
  if (!href) throw new Error(`link has no href: ${tag}`);
  return href;
}

/** The bytes a link carries, decoded from its data URI. */
export function fileOf(tag: string): string {
  const href = hrefOf(tag);
  const comma = href.indexOf(",");
  if (comma <= 0) throw new Error(`not a data URI: ${href}`);
  return decodeURIComponent(href.slice(comma + 1));
}

/** The table as rows of cell text, header included. */
export function tableOf(html: string): string[][] {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => cell[1]!),
  );
}

/** A small RFC 4180 reader, enough to compare the file with the table. */
export function parseCsv(text: string): string[][] {
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
