import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { patternOf, t } from "../../i18n/index.ts";
import { selectRecords, type SelectedRecord } from "../../src/records.ts";
import { baseOf, withBase } from "../../src/url.ts";
import recordTable, { columnsOf as parseColumns, type RecordColumn } from "../record-table/index.ts";

/** The Markdown directive this component handles: `::data-explorer{from=books columns=title,year}`. */
export const directive = "data-explorer";

/** Rows the static table shows: the island's first page holds the same number. */
export const PAGE_SIZE = 50;

/** The GET parameter that narrows the site search to one collection's record pages. */
export const COLLECTION_FILTER = "filter.collection";

/** Id of the query field; the form's label points at it. */
export const QUERY_ID = "data-explorer-query";

/** Id of the sort field; its label points at it. */
export const SORT_ID = "data-explorer-sort";

/** The site's search results page, which answers a submit without any script. */
export const SEARCH_PATH = "/search/";

/** The directive's options, in the order the docs page lists them. */
export const OPTIONS = ["from", "columns", "filters", "sort"] as const;

/** Props from the directive. */
export type DataExplorerProps = {
  /** The collection to explore, lowercase as the site config writes it. */
  from?: string;
  /** The fields the table shows in display order: `title,author,year`, or a JSON column array. */
  columns?: string | readonly RecordColumn[];
  /** The fields the island offers as filters, such as `author,status`; a field with one value is skipped. */
  filters?: string;
  /** The fields the island offers as sort choices, such as `title,year`; relevance comes first. */
  sort?: string;
};

/** A comma list of field names, such as the `filters` prop. */
function fieldsOf(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");
}

/** A JSON column array passes through; a bare comma list becomes fields with the field as the label. */
function columnsOf(value: unknown): RecordColumn[] {
  if (typeof value !== "string") return parseColumns(value);
  const text = value.trim();
  if (text.startsWith("[")) return parseColumns(text);
  return text
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "")
    .map((field) => ({ field }));
}

/**
 * The explorer without JavaScript: a labelled `GET` form that submits to the site's search results
 * page with the collection as a filter, and the first records of the collection as the same table the
 * island draws. Every message the island needs travels as a `data-` attribute in the page language, as
 * the search dialog does, so the island carries no catalog. The sort control starts `hidden`, because
 * it would do nothing without a script; the island reveals it.
 */
export default function dataExplorer({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as DataExplorerProps;
  const lang = page?.lang ?? "en";
  const from = typeof input.from === "string" ? input.from.trim() : "";
  const columns = columnsOf(input.columns);
  const filters = fieldsOf(input.filters);
  const sortables = fieldsOf(input.sort).map((field) => {
    const column = columns.find((entry) => entry.field === field);
    return { field, kind: column?.kind ?? "text", label: column?.label ?? field };
  });

  // record-table owns both notes: a page that names no setup, and a collection the site lacks.
  const table = (records?: readonly SelectedRecord[]) =>
    recordTable({ props: { from, columns, records }, page, site, html: "" } as never);

  if (from === "" || columns.length === 0) return table();

  const selection = selectRecords(site, page, { collection: from, limit: PAGE_SIZE });
  if (!selection.ok) return table();

  const base = baseOf(site);
  return h(
    "div",
    {
      class: "data-explorer",
      "data-explorer": "",
      "data-base": base,
      "data-collection": from,
      "data-lang": lang,
      "data-explorer-loading": t(lang, "search_loading"),
      "data-explorer-failed": t(lang, "search_results_failed"),
      "data-explorer-empty": patternOf(lang, "search_results_empty"),
      "data-explorer-retry": t(lang, "search_retry"),
      "data-explorer-more": t(lang, "data_explorer_more"),
      "data-explorer-relevance": t(lang, "data_explorer_relevance"),
      "data-explorer-ascending": t(lang, "data_explorer_sort_ascending"),
      "data-explorer-descending": t(lang, "data_explorer_sort_descending"),
      "data-explorer-no-value": t(lang, "field_empty"),
      "data-explorer-filter-column": patternOf(lang, "record_table_filter_column"),
      "data-explorer-filter-empty": t(lang, "record_table_filter_empty"),
      "data-explorer-remove": patternOf(lang, "data_explorer_filter_remove"),
      "data-filters": JSON.stringify(filters),
      "data-sort": JSON.stringify(sortables),
      "data-columns": JSON.stringify(columns.map(({ field, label, kind }) => ({ field, label, kind }))),
      "data-explorer-count-zero": patternOf(lang, "search_count_zero"),
      "data-explorer-count-one": patternOf(lang, "search_count_one"),
      "data-explorer-count-two": patternOf(lang, "search_count_two"),
      "data-explorer-count-few": patternOf(lang, "search_count_few"),
      "data-explorer-count-many": patternOf(lang, "search_count_many"),
      "data-explorer-count-other": patternOf(lang, "search_count_other"),
    },
    h(
      "form",
      { class: "data-explorer-form", role: "search", method: "get", action: withBase(base, SEARCH_PATH) },
      h("label", { class: "data-explorer-label", for: QUERY_ID }, t(lang, "search")),
      h("input", { class: "data-explorer-input", id: QUERY_ID, name: "q", type: "search", autocomplete: "off" }),
      h("input", { type: "hidden", name: COLLECTION_FILTER, value: from }),
      h("button", { class: "data-explorer-submit", type: "submit" }, t(lang, "search")),
      sortables.length === 0
        ? null
        : h(
            "div",
            { class: "data-explorer-sort", "data-explorer-sort": "", hidden: true },
            h("label", { class: "data-explorer-sort-label", for: SORT_ID }, t(lang, "data_explorer_sort")),
            h("select", { class: "data-explorer-sort-field", id: SORT_ID, "data-explorer-sort-field": "" }),
          ),
    ),
    filters.length === 0
      ? null
      : h("div", { class: "data-explorer-filters", "data-explorer-filters": "", hidden: true }),
    filters.length === 0 ? null : h("div", { class: "data-explorer-chips", "data-explorer-chips": "", hidden: true }),
    h("p", { class: "data-explorer-status", role: "status" }),
    table(selection.records),
    h("p", { class: "data-explorer-empty", hidden: true }),
    h("button", { class: "data-explorer-more", type: "button", hidden: true }, t(lang, "data_explorer_more")),
  );
}
