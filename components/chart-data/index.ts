import { h } from "preact";
import { formatNumber } from "../../src/report.ts";
import chartDownloads from "./download.ts";
import { numericValue } from "./input.ts";

/** Class on the closed disclosure that holds the table. */
export const DETAILS_CLASS = "chart-data";

/** Class on the disclosure control. */
export const SUMMARY_CLASS = "chart-data-summary";

/** Class on the body that holds the description and the table. */
export const BODY_CLASS = "chart-data-body";

/** Class on the sentence that says what the chart shows. */
export const DESCRIPTION_CLASS = "chart-data-description";

/** Class on the table, the chart's text alternative. */
export const TABLE_CLASS = "chart-data-table";

/** Class on a cell whose row has no value. */
export const NO_VALUE_CLASS = "chart-data-no-value";

/** What the disclosure says when the chart gives no summary of its own. */
export const DEFAULT_SUMMARY = "View the data as a table";

/** The note in the table for a row with no value. */
export const NO_VALUE_TEXT = "No value";

/** A cell: a number formatted for the page, text as given, or no value at all. */
export type ChartDataCell = string | number | undefined;

/** One row of the table: its category label and one cell per series. */
export interface ChartDataRow {
  readonly id?: string;
  readonly label: string;
  readonly values: readonly ChartDataCell[];
}

export type ChartDataProps = {
  /** Table caption and the name of the data. */
  readonly title: string;
  /** What the chart shows, stated in a sentence. */
  readonly description: string;
  /** Heading of the category column. */
  readonly labelHeading: string;
  /** Headings of the value columns, one per series. */
  readonly columns: readonly string[];
  /** The rows the chart plots, in the chart's order. */
  readonly rows: readonly ChartDataRow[];
  /** The page language, used for number formatting. */
  readonly lang: string;
  /** Id of the chart; gives the downloaded files their name. Omit to offer no downloads. */
  readonly id?: string;
  /** Text of the disclosure control. */
  readonly summary?: string;
};

/** One cell: a formatted number, the text as given, or a visible note for a missing value. */
function cell(value: ChartDataCell, lang: string) {
  // A number that is not finite is a missing value, the same note an absent cell gets.
  const number = typeof value === "number" ? numericValue(value) : undefined;
  if (value === undefined || (typeof value === "number" && number === undefined)) {
    return h("td", { class: NO_VALUE_CLASS }, NO_VALUE_TEXT);
  }
  return h("td", null, number === undefined ? value : formatNumber(lang, number));
}

/**
 * The data table under a chart: the same rows the chart plots, in the same order, inside a closed
 * `<details>` so the chart stays the focus while the table remains one keypress away. Numbers use the
 * page's formatting and a row with no value says "No value" instead of disappearing. The table is
 * the chart's text alternative; `styles/print.css` opens the closed disclosure on paper.
 */
export default function chartData(props: ChartDataProps) {
  const summary = props.summary?.trim() ? props.summary.trim() : DEFAULT_SUMMARY;
  return h(
    "details",
    { class: DETAILS_CLASS },
    h("summary", { class: SUMMARY_CLASS }, summary),
    h(
      "div",
      { class: BODY_CLASS },
      h("p", { class: DESCRIPTION_CLASS }, props.description),
      h(
        "table",
        { class: TABLE_CLASS },
        h("caption", null, props.title),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", { scope: "col" }, props.labelHeading),
            ...props.columns.map((column) => h("th", { scope: "col" }, column)),
          ),
        ),
        h(
          "tbody",
          null,
          ...props.rows.map((row, index) =>
            h(
              "tr",
              { key: row.id ?? index },
              h("th", { scope: "row" }, row.label),
              ...row.values.map((value) => cell(value, props.lang)),
            ),
          ),
        ),
      ),
      props.id?.trim()
        ? chartDownloads({
            id: props.id,
            title: props.title,
            labelHeading: props.labelHeading,
            columns: props.columns,
            rows: props.rows,
          })
        : null,
    ),
  );
}
