import { h } from "preact";
import type { ChartDataCell, ChartDataRow } from "./index.ts";

/** Class on the list of download links under the table. */
export const DOWNLOAD_CLASS = "chart-data-downloads";

/** What the group of links is called for a screen reader. */
export const DOWNLOAD_LABEL = "Download the chart data";

/** Media type of the CSV file. */
export const CSV_TYPE = "text/csv;charset=utf-8";

/** Media type of the JSON file. */
export const JSON_TYPE = "application/json;charset=utf-8";

/** The formats offered, in the order the links appear. */
export const FORMATS = ["csv", "json"] as const;
export type DownloadFormat = (typeof FORMATS)[number];

/** The one media type each published format saves as. */
export const TYPES: Record<DownloadFormat, string> = { csv: CSV_TYPE, json: JSON_TYPE };

/** One downloadable file: its bytes, the name it saves as, and the link that carries it. */
export interface ChartDownload {
  readonly format: DownloadFormat;
  readonly fileName: string;
  readonly type: string;
  readonly href: string;
  readonly text: string;
}

export interface ChartDownloadProps {
  /** Id of the chart; names the files. */
  readonly id: string;
  /** Name of the chart, used in each link's accessible name. */
  readonly title: string;
  /** Heading of the category column. */
  readonly labelHeading: string;
  /** Headings of the value columns, one per series. */
  readonly columns: readonly string[];
  /** The rows the table shows, in the table's order. */
  readonly rows: readonly ChartDataRow[];
}

/** A cell as data: the raw number or text, and an empty field for a missing value. */
function cellText(value: ChartDataCell): string {
  return value === undefined ? "" : String(value);
}

/** A CSV field, quoted when it holds a comma, a quote, or a line break. */
function quote(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/** The table as RFC 4180 CSV: the same headings and rows, with raw values and an empty cell for no value. */
export function csvOf(
  labelHeading: string,
  columns: readonly string[],
  rows: readonly ChartDataRow[],
): string {
  const lines = [
    [labelHeading, ...columns],
    ...rows.map((row) => [row.label, ...row.values.map(cellText)]),
  ];
  return `${lines.map((line) => line.map(quote).join(",")).join("\n")}\n`;
}

/** The table as JSON: one object per row, keyed by the table's headings, with null for no value. */
export function jsonOf(
  labelHeading: string,
  columns: readonly string[],
  rows: readonly ChartDataRow[],
): string {
  const records = rows.map((row) => {
    const record: Record<string, string | number | null> = { [labelHeading]: row.label };
    row.values.forEach((value, index) => {
      record[columns[index] ?? `value-${index + 1}`] = value ?? null;
    });
    return record;
  });
  return `${JSON.stringify(records, null, 2)}\n`;
}

/** The name a chart's file saves as: its id reduced to letters, digits, `-`, and `_`. */
export function fileNameOf(id: string, format: DownloadFormat): string {
  const base = id
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base === "" ? "chart-data" : base}.${format}`;
}

/** A link that carries the file's bytes, written into the page at build time and never in the browser. */
export function hrefOf(type: string, contents: string): string {
  return `data:${type},${encodeURIComponent(contents)}`;
}

/** One format's link, or no link when the file is missing; names and media type come from `format`. */
export function downloadOf(
  format: DownloadFormat,
  id: string,
  contents: string | undefined,
): ChartDownload | undefined {
  if (contents === undefined) return undefined;
  const type = TYPES[format];
  return {
    format,
    fileName: fileNameOf(id, format),
    type,
    href: hrefOf(type, contents),
    text: `Download ${format.toUpperCase()}`,
  };
}

/** The two files, built from the same rows as the table, named from the chart's id. */
export function downloadsOf(props: ChartDownloadProps): ChartDownload[] {
  const contents: Record<DownloadFormat, string> = {
    csv: csvOf(props.labelHeading, props.columns, props.rows),
    json: jsonOf(props.labelHeading, props.columns, props.rows),
  };
  return FORMATS.flatMap((format) => downloadOf(format, props.id, contents[format]) ?? []);
}

/**
 * The CSV and JSON links next to a chart's table. Both files are serialized while the page is built and
 * carried in the link's `href`, so a reader downloads the chart's own rows without a script, a fetch, or
 * any work on the device; each link's `download` name comes from the chart's id.
 *
 * shortcut: the bytes ride in a data URI, the only output a theme component controls; move to emitted
 * files once a chart's download can pass the ~2 MB browsers accept in one link.
 */
export default function chartDownloads(props: ChartDownloadProps) {
  return h(
    "nav",
    { class: DOWNLOAD_CLASS, "aria-label": DOWNLOAD_LABEL },
    ...downloadsOf(props).map((file) =>
      h(
        "a",
        {
          href: file.href,
          download: file.fileName,
          "aria-label": `${file.text}: ${props.title}`,
        },
        file.text,
      ),
    ),
  );
}
