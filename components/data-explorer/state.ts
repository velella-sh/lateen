/* The data explorer's query state: what the address, the controls, and the index say, and the rows a
 * query leaves. Filtering, sorting, pagination, the address, and the active-row transitions are pure
 * functions over plain data, so `client.ts` only applies the result to the page and a test reads the
 * same rules without a browser. */

import { withParams, type ParamValue } from "../../src/url.ts";
import { isRecord, parseJson } from "../../src/guards.ts";
import { sortKey, sortRows, type SortDirection } from "../../src/sort.ts";
import { URL_COLUMN, type CollectionIndex, type IndexRow } from "./index-loader.ts";
import { matchRows, prepareRows, type PreparedRow } from "./match.ts";

/** The search results contract's parameter names, so an explorer address and the no-script form agree. */
export const QUERY_PARAM = "q";
export const FILTER_PARAM = "filter.";
export const SORT_PARAM = "sort";
export const ORDER_PARAM = "order";

/** One column the table shows, from the directive's array. */
export interface Column {
  readonly field: string;
  readonly kind: string;
  readonly label?: string;
}

/** One field the page offers as a sort choice, from the root's `data-sort`. */
export interface Sortable {
  readonly field: string;
  readonly kind: string;
  readonly label: string;
}

/** The chosen sort: a sortable field, its kind, and the direction. */
export interface Sort {
  readonly field: string;
  readonly kind: string;
  readonly direction: SortDirection;
}

/** One value of a filter field, with the count the index or the current query gives it. */
export interface FacetValue {
  readonly raw: string;
  readonly count: number;
}

/** One filter field: its values in the index's order. */
export interface Facet {
  readonly field: string;
  readonly label: string;
  readonly kind: string;
  readonly values: readonly FacetValue[];
}

/** Everything the island reads from the address and keeps in step with the controls. */
export interface Selection {
  readonly query: string;
  /** Field → chosen raw values. */
  readonly filters: ReadonlyMap<string, readonly string[]>;
  readonly sort: Sort | undefined;
}

/** The index once it arrived: the rows prepared for matching, and the facets the page offers. */
export interface ExplorerModel {
  readonly index: CollectionIndex;
  readonly prepared: readonly PreparedRow[];
  readonly facets: readonly Facet[];
  readonly lang: string;
}

/** The filter fields from the root's `data-filters`, a JSON array. */
export function fieldsOf(text: string | null): string[] {
  if (text === null) return [];
  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((field): field is string => typeof field === "string" && field !== "");
}

/** The display columns from the root's `data-columns`; the index's own columns when it names none. */
export function columnsOf(text: string | null, index?: CollectionIndex): Column[] {
  if (text !== null) {
    const parsed = parseJson(text);
    if (Array.isArray(parsed)) {
      const columns = parsed.flatMap((entry): Column[] => {
        if (!isRecord(entry) || typeof entry.field !== "string" || entry.field === "") return [];
        return [{
          field: entry.field,
          kind: typeof entry.kind === "string" ? entry.kind : "text",
          ...(typeof entry.label === "string" ? { label: entry.label } : {}),
        }];
      });
      // A malformed attribute falls through to the index's columns.
      if (columns.length > 0) return columns;
    }
  }
  return (index?.columns ?? []).filter((field) => field !== URL_COLUMN).map((field) => ({ field, kind: "text" }));
}

/** The sortable fields from the root's `data-sort`, a JSON array. */
export function sortablesOf(text: string | null): Sortable[] {
  if (text === null) return [];
  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): Sortable[] => {
    if (!isRecord(entry) || typeof entry.field !== "string" || entry.field === "") return [];
    return [{
      field: entry.field,
      kind: typeof entry.kind === "string" ? entry.kind : "text",
      label: typeof entry.label === "string" && entry.label !== "" ? entry.label : entry.field,
    }];
  });
}

/** True when a cell carries nothing, as the static table reads it. */
export function isEmptyCell(value: IndexRow[number] | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/** A cell as text in the page language: a list joins with commas, a number takes its digits. */
export function textOf(value: Exclude<IndexRow[number], null | undefined>, kind: string, lang: string): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (kind === "number" && typeof value !== "boolean") {
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) {
      try {
        return new Intl.NumberFormat(lang).format(number);
      } catch {
        return String(number);
      }
    }
  }
  return String(value);
}

/** A count in the page's digits: Arabic shows Arabic-Indic digits, Persian Persian ones, the rest Latin. */
export function formatNumber(lang: string, value: number): string {
  const language = lang.toLowerCase();
  const numberingSystem = language.startsWith("ar") ? "arab" : language.startsWith("fa") ? "arabext" : "latn";
  try {
    return new Intl.NumberFormat(lang, { numberingSystem }).format(value);
  } catch {
    return String(value);
  }
}

/** A cell as the text the filters compare it by; an empty cell matches no value. */
function cellText(row: IndexRow, at: number, kind: string, lang: string): string {
  const value = row[at];
  if (value === null || value === undefined) return "";
  return textOf(value, kind, lang);
}

/**
 * The facets the page offers: one per named field that holds two or more values in the index, with the
 * index's own counts. `facetCounts` keeps them in step with the query and the other fields.
 */
export function buildFacets(
  index: CollectionIndex,
  columns: readonly Column[],
  fields: readonly string[],
  lang: string,
): Facet[] {
  const facets: Facet[] = [];
  for (const field of fields) {
    const at = index.columns.indexOf(field);
    if (at < 0) continue;
    const column = columns.find((entry) => entry.field === field);
    const kind = column?.kind ?? "text";
    const seen = new Map<string, number>();
    for (const row of index.rows) {
      const text = cellText(row, at, kind, lang);
      if (text !== "") seen.set(text, (seen.get(text) ?? 0) + 1);
    }
    if (seen.size < 2) continue;
    facets.push({
      field,
      label: column?.label ?? field,
      kind,
      values: [...seen].map(([raw, count]) => ({ raw, count })),
    });
  }
  return facets;
}

/** The prepared index and its facets: what the island keeps once the loader hands over the rows. */
export function createModel(
  index: CollectionIndex,
  columns: readonly Column[],
  fields: readonly string[],
  lang: string,
): ExplorerModel {
  return {
    index,
    prepared: prepareRows(index, columns.map((column) => column.field)),
    facets: buildFacets(index, columns, fields, lang),
    lang,
  };
}

/** The chosen values of one facet, in the facet's order; values the index lacks are ignored. */
function chosen(facet: Facet, filters: Selection["filters"]): string[] {
  const picked = filters.get(facet.field) ?? [];
  if (picked.length === 0) return [];
  return facet.values.map((value) => value.raw).filter((raw) => picked.includes(raw));
}

/** True when `row` passes `facet`: no chosen values, a field the index lacks, or a chosen value. */
function passes(
  row: IndexRow,
  facet: Facet,
  at: number,
  filters: Selection["filters"],
  lang: string,
): boolean {
  const values = chosen(facet, filters);
  if (values.length === 0) return true;
  return at < 0 || values.includes(cellText(row, at, facet.kind, lang));
}

/** The rows the query and the filters leave, in the chosen sort's order. */
export function matchingRows(model: ExplorerModel, selection: Selection): readonly IndexRow[] {
  const { index, prepared, facets, lang } = model;
  const rows = matchRows(prepared, selection.query).filter((row) =>
    facets.every((facet) => passes(row, facet, index.columns.indexOf(facet.field), selection.filters, lang)),
  );
  const sort = selection.sort;
  if (sort === undefined) return rows;
  const at = index.columns.indexOf(sort.field);
  if (at < 0) return rows;
  return sortRows(rows, (row) => sortKey(row[at], sort.kind), sort.kind, sort.direction, lang);
}

/**
 * The facets with each value's count under the query and the other fields: a facet's own choice is
 * ignored, so an unchosen value stays reachable.
 */
export function facetCounts(model: ExplorerModel, selection: Selection): Facet[] {
  const { index, prepared, facets, lang } = model;
  const textRows = new Set(matchRows(prepared, selection.query));
  const positions = facets.map((facet) => index.columns.indexOf(facet.field));
  const counts = facets.map(() => new Map<string, number>());

  for (const entry of prepared) {
    if (!textRows.has(entry.row)) continue;
    const passed = facets.map((facet, at) =>
      passes(entry.row, facet, positions[at] ?? -1, selection.filters, lang),
    );
    facets.forEach((facet, at) => {
      if (!facets.every((_, other) => other === at || passed[other] === true)) return;
      const position = positions[at] ?? -1;
      if (position < 0) return;
      const text = cellText(entry.row, position, facet.kind, lang);
      if (text === "") return;
      const tally = counts[at] as Map<string, number>;
      tally.set(text, (tally.get(text) ?? 0) + 1);
    });
  }

  return facets.map((facet, at) => ({
    ...facet,
    values: facet.values.map((value) => ({ ...value, count: (counts[at] as Map<string, number>).get(value.raw) ?? 0 })),
  }));
}

/** True while the table shows a result the address should keep. */
export function hasState(selection: Selection, facets: readonly Facet[]): boolean {
  return (
    selection.query.trim() !== "" ||
    selection.sort !== undefined ||
    facets.some((facet) => chosen(facet, selection.filters).length > 0)
  );
}

/** The rows of the page ending at `limit`. */
export function pageRows(rows: readonly IndexRow[], limit: number): readonly IndexRow[] {
  return rows.slice(0, limit);
}

/** True while more rows wait behind the "show more" button. */
export function hasMore(rows: readonly IndexRow[], limit: number): boolean {
  return rows.length > limit;
}

/** The active row after an arrow key: one step, wrapping at both ends. `-1` when nothing is drawn. */
export function nextActive(active: number, length: number, key: "ArrowDown" | "ArrowUp"): number {
  if (length === 0) return -1;
  if (key === "ArrowDown") return active + 1 >= length ? 0 : active + 1;
  return active <= 0 ? length - 1 : active - 1;
}

/** The row Enter opens: the active one, or the first when nothing is active. `-1` when nothing is drawn. */
export function enterTarget(active: number, length: number): number {
  if (length === 0) return -1;
  return active >= 0 && active < length ? active : 0;
}

/** The chosen sort, when the page offers the field and the value names a direction. */
export function sortOf(value: string, sortables: readonly Sortable[]): Sort | undefined {
  const [field = "", direction] = value.split(":");
  const sortable = sortables.find((entry) => entry.field === field);
  if (sortable === undefined) return undefined;
  if (direction !== "ascending" && direction !== "descending") return undefined;
  return { field: sortable.field, kind: sortable.kind, direction };
}

/** The sort control's value for `sort`: empty is relevance. */
export function sortValue(sort: Sort | undefined): string {
  return sort === undefined ? "" : `${sort.field}:${sort.direction}`;
}

/** The selection an address names; a sort direction the page does not offer reads as relevance. */
export function readAddress(search: string, sortables: readonly Sortable[]): Selection {
  const params = new URLSearchParams(search);
  const filters = new Map<string, string[]>();
  for (const [key, value] of params) {
    if (!key.startsWith(FILTER_PARAM)) continue;
    const name = key.slice(FILTER_PARAM.length);
    if (name === "" || name === "collection") continue;
    filters.set(name, [...(filters.get(name) ?? []), value]);
  }
  const order = params.get(ORDER_PARAM);
  const direction = order === "asc" ? "ascending" : order === "desc" ? "descending" : undefined;
  return {
    query: params.get(QUERY_PARAM) ?? "",
    filters,
    sort: direction === undefined ? undefined : sortOf(`${params.get(SORT_PARAM) ?? ""}:${direction}`, sortables),
  };
}

/**
 * The address with this explorer's keys replaced and every other parameter and the fragment kept.
 * Values are written in the facets' order, and a value the index lacks is dropped.
 */
export function writeAddress(href: string, selection: Selection, facets: readonly Facet[]): string {
  const changes: Record<string, ParamValue> = {};
  const text = selection.query.trim();
  if (text !== "") changes[QUERY_PARAM] = text;
  for (const facet of facets) {
    const picked = selection.filters.get(facet.field) ?? [];
    const values = facet.values.map((value) => value.raw).filter((raw) => picked.includes(raw));
    if (values.length > 0) changes[`${FILTER_PARAM}${facet.field}`] = values;
  }
  if (selection.sort !== undefined) {
    changes[SORT_PARAM] = selection.sort.field;
    changes[ORDER_PARAM] = selection.sort.direction === "descending" ? "desc" : "asc";
  }
  const own = (key: string): boolean =>
    key === QUERY_PARAM || key === SORT_PARAM || key === ORDER_PARAM || key.startsWith(FILTER_PARAM);
  return withParams(href, changes, own);
}
