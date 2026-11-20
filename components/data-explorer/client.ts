/* The data explorer's island: typing filters the collection's index into the table the page already
 * shows, and clearing brings the static rows back. The merged loader starts the index on the field's
 * first focus, never on page load, and a query is matched once the reader pauses (see `DEBOUNCE_MS`),
 * so a fast typist matches once. At most `ROW_LIMIT` rows show; the button `index.ts` writes hidden
 * reveals the next page. Every word the island says comes from a `data-` attribute in the page
 * language. */

import { matchRows, prepareRows, type PreparedRow } from "./match.ts";
import {
  createIndexLoader,
  URL_COLUMN,
  type CollectionIndex,
  type IndexField,
  type IndexRow,
} from "./index-loader.ts";
import { withBase } from "../../src/url.ts";
import { sortKey, sortRows, type SortDirection } from "../../src/sort.ts";

/** The explorer root the island finds. */
export const ROOT_SELECTOR = "[data-explorer]";

/** The query field. */
export const INPUT_SELECTOR = ".data-explorer-input";

/** The live region that announces the result count. */
export const STATUS_SELECTOR = ".data-explorer-status";

/** The note that names the query when nothing matches. */
export const EMPTY_SELECTOR = ".data-explorer-empty";

/** The button that reveals the next page of matches. */
export const MORE_SELECTOR = ".data-explorer-more";

/** The sort control's wrapper and its select. */
export const SORT_SELECTOR = "[data-explorer-sort]";
export const SORT_FIELD_SELECTOR = ".data-explorer-sort-field";

/** The filter fields the island fills after the index loads. */
export const FILTERS_SELECTOR = "[data-explorer-filters]";

/** The removable chips naming the active filters. */
export const CHIPS_SELECTOR = "[data-explorer-chips]";

/** The box that scrolls the table; hidden while an empty note shows. */
export const TABLE_SELECTOR = ".table-scroll";

/** The table body the island replaces. */
export const BODY_SELECTOR = "tbody";

/** The body row the island reads and writes. */
export const ROW_SELECTOR = "tbody tr";

/** The id prefix of a drawn result row. */
export const OPTION_ID_PREFIX = "explorer-option-";

/** The class the active result row carries. */
export const ACTIVE_ROW_CLASS = "data-explorer-active";

/** The id of the drawn row at `index`: positional, so the field's reference follows its place. */
export function optionId(index: number): string {
  return `${OPTION_ID_PREFIX}${index + 1}`;
}

/** How long typing rests before the query runs. */
export const DEBOUNCE_MS = 150;

/** Rows one page shows; the same number `index.ts` renders as the static table. */
export const ROW_LIMIT = 50;

/** The search results contract's parameter names, so an explorer address and the no-script form agree. */
export const QUERY_PARAM = "q";
export const FILTER_PARAM = "filter.";
export const SORT_PARAM = "sort";
export const ORDER_PARAM = "order";

/** A key press as the island reads it. */
export interface ExplorerKeyEvent {
  readonly key?: string | undefined;
  preventDefault(): void;
}

/** The part of an element the island uses. */
export interface ExplorerElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: (event: ExplorerKeyEvent) => void): void;
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  append(...children: ExplorerElement[]): void;
  replaceChildren(...children: ExplorerElement[]): void;
  /** Follows a result link, as a pointer would. */
  click?(): void;
  /** Moves focus to the element, where the browser can. */
  focus?(): void;
  /** Brings the active row into view, where the browser can scroll. */
  scrollIntoView?(options: { readonly block: "nearest" }): void;
  textContent: string | null;
  innerHTML: string;
  hidden: boolean;
  checked?: boolean;
  value?: string;
  ownerDocument?: ExplorerDocument | null;
}

/** The page address, read without reloading it. */
export interface ExplorerLocation {
  href: string;
  search: string;
}

/** The page history, written without adding an entry. */
export interface ExplorerHistory {
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/** The part of the window the island uses to keep the address in step. */
export interface ExplorerWindow {
  location: ExplorerLocation;
  history: ExplorerHistory;
  addEventListener(type: "popstate", listener: () => void): void;
}

/** The part of the document the island uses. */
export interface ExplorerDocument {
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  createElement(tag: string): ExplorerElement;
  documentElement?: { getAttribute(name: string): string | null } | null;
  defaultView?: ExplorerWindow | null;
}

/** What the island reads from the world; tests pass a fake fetch and clock. */
export interface ExplorerEnv {
  fetchText(url: string, signal: AbortSignal): Promise<string>;
  schedule(listener: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

/** The browser environment: `fetch`, and the document's timers. */
export const browserEnv: ExplorerEnv = {
  async fetchText(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.text();
  },
  schedule: (listener, ms) => setTimeout(listener, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** One column the table shows, from the directive's array. */
interface Column {
  readonly field: string;
  readonly kind: string;
  readonly label?: string;
}

/** The filter fields from the root's `data-filters`, a JSON array. */
function fieldsOf(text: string | null): string[] {
  if (text === null) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((field): field is string => typeof field === "string" && field !== "");
  } catch {
    return [];
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The display columns from the root's `data-columns`; the index's own columns when it names none. */
function columnsOf(text: string | null, index?: CollectionIndex): Column[] {
  if (text !== null) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const columns = parsed.flatMap((entry): Column[] => {
          if (!isRecord(entry) || typeof entry.field !== "string" || entry.field === "") return [];
          return [{
            field: entry.field,
            kind: typeof entry.kind === "string" ? entry.kind : "text",
            ...(typeof entry.label === "string" ? { label: entry.label } : {}),
          }];
        });
        if (columns.length > 0) return columns;
      }
    } catch {
      // A malformed attribute falls through to the index's columns.
    }
  }
  return (index?.columns ?? []).filter((field) => field !== URL_COLUMN).map((field) => ({ field, kind: "text" }));
}

/** One field the page offers as a sort choice, from the root's `data-sort`. */
interface Sortable {
  readonly field: string;
  readonly kind: string;
  readonly label: string;
}

/** The sortable fields from the root's `data-sort`, a JSON array. */
function sortablesOf(text: string | null): Sortable[] {
  if (text === null) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): Sortable[] => {
      if (!isRecord(entry) || typeof entry.field !== "string" || entry.field === "") return [];
      return [{
        field: entry.field,
        kind: typeof entry.kind === "string" ? entry.kind : "text",
        label: typeof entry.label === "string" && entry.label !== "" ? entry.label : entry.field,
      }];
    });
  } catch {
    return [];
  }
}

/** True when a cell carries nothing, as the static table reads it. */
function isEmptyCell(value: IndexRow[number] | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/** A cell as text in the page language: a list joins with commas, a number takes its digits. */
function textOf(value: Exclude<IndexRow[number], null | undefined>, kind: string, lang: string): string {
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

/** The count pattern for the page language's plural category. */
function countText(root: ExplorerElement, lang: string, count: number): string {
  let category = "other";
  try {
    category = new Intl.PluralRules(lang).select(count);
  } catch {
    // A language without plural rules keeps the `other` pattern.
  }
  const pattern =
    root.getAttribute(`data-explorer-count-${category}`) ?? root.getAttribute("data-explorer-count-other") ?? "";
  return pattern.replace("{n}", String(count));
}

/** A count in the page's digits. */
function formatNumber(lang: string, value: number): string {
  try {
    return new Intl.NumberFormat(lang).format(value);
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

/** One value of a filter field, with the checkbox and the count it shows. */
interface FacetValue {
  readonly raw: string;
  readonly input: ExplorerElement;
  readonly count: ExplorerElement;
}

/** One filter field: its values in the index's order, and its fieldset in the page. */
interface Facet {
  readonly field: string;
  readonly label: string;
  readonly kind: string;
  readonly values: readonly FacetValue[];
}

/**
 * Fills the filter box with one checkbox per value of every named field that holds two or more
 * values, and returns the fields it drew. The counts start as the index's own counts; `render`
 * keeps them in step with the query and the other fields.
 */
function buildFacets(
  root: ExplorerElement,
  doc: ExplorerDocument,
  box: ExplorerElement,
  index: CollectionIndex,
  columns: readonly Column[],
  fields: readonly string[],
  lang: string,
): Facet[] {
  const pattern = root.getAttribute("data-explorer-filter-column") ?? "{column}";
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

    const fieldset = doc.createElement("fieldset");
    fieldset.setAttribute("class", "data-explorer-filter");
    const legend = doc.createElement("legend");
    legend.setAttribute("class", "data-explorer-filter-label");
    legend.textContent = pattern.replace("{column}", column?.label ?? field);
    fieldset.append(legend);

    const values: FacetValue[] = [];
    for (const [text, count] of seen) {
      const option = doc.createElement("label");
      option.setAttribute("class", "data-explorer-filter-option");
      const input = doc.createElement("input");
      input.setAttribute("type", "checkbox");
      input.setAttribute("value", text);
      input.checked = false;
      const name = doc.createElement("span");
      name.setAttribute("class", "data-explorer-filter-value");
      name.textContent = text;
      const tally = doc.createElement("span");
      tally.setAttribute("class", "data-explorer-filter-count");
      tally.textContent = `(${formatNumber(lang, count)})`;
      option.append(input, name, tally);
      fieldset.append(option);
      values.push({ raw: text, input, count: tally });
    }
    box.append(fieldset);
    facets.push({ field, label: column?.label ?? field, kind, values });
  }

  return facets;
}


function rowOf(
  doc: ExplorerDocument,
  row: IndexRow,
  columns: readonly Column[],
  index: CollectionIndex,
  base: string,
  lang: string,
  noValue: string,
): ExplorerElement {
  const tr = doc.createElement("tr");
  const urlAt = index.columns.indexOf(URL_COLUMN);
  const url = urlAt < 0 ? "" : row[urlAt];

  columns.forEach((column, at) => {
    const position = index.columns.indexOf(column.field);
    const value = position < 0 ? undefined : row[position];
    const td = doc.createElement("td");
    td.setAttribute("class", "record-table-cell");
    td.setAttribute("data-kind", column.kind);

    if (isEmptyCell(value)) {
      const span = doc.createElement("span");
      span.setAttribute("class", "field-empty");
      span.textContent = noValue;
      td.append(span);
    } else {
      const text = textOf(value as Exclude<IndexRow[number], null | undefined>, column.kind, lang);
      td.setAttribute("data-value", String(value));
      if (at === 0 && typeof url === "string" && url !== "") {
        const link = doc.createElement("a");
        link.setAttribute("href", withBase(base, url));
        link.textContent = text;
        td.append(link);
      } else {
        td.textContent = text;
      }
    }
    tr.append(td);
  });
  return tr;
}

/** One explorer: the index, the query in hand, and the rows the table currently shows. */
function attach(root: ExplorerElement, doc: ExplorerDocument, env: ExplorerEnv): void {
  const field = root.querySelector(INPUT_SELECTOR);
  const table = root.querySelector(TABLE_SELECTOR);
  const body = table?.querySelector(BODY_SELECTOR) ?? null;
  if (field === null || body === null) return;
  const status = root.querySelector(STATUS_SELECTOR);
  const empty = root.querySelector(EMPTY_SELECTOR);
  const more = root.querySelector(MORE_SELECTOR);
  const filtersBox = root.querySelector(FILTERS_SELECTOR);
  const chips = root.querySelector(CHIPS_SELECTOR);
  const sortBox = root.querySelector(SORT_SELECTOR);
  const sortSelect = root.querySelector(SORT_FIELD_SELECTOR);

  // The field is the combobox: the result rows are its list, and the keys never leave the field. The
  // static markup stays a plain search field until the island runs.
  field.setAttribute("role", "combobox");
  field.setAttribute("aria-expanded", "false");

  const base = root.getAttribute("data-base") ?? "";
  const collection = root.getAttribute("data-collection") ?? "";
  const lang = root.getAttribute("data-lang") ?? "en";
  const noValue = root.getAttribute("data-explorer-no-value") ?? "";
  const loadingText = root.getAttribute("data-explorer-loading") ?? "";
  const failedText = root.getAttribute("data-explorer-failed") ?? "";
  const emptyPattern = root.getAttribute("data-explorer-empty") ?? "";
  const filterEmpty = root.getAttribute("data-explorer-filter-empty") ?? "";
  const removePattern = root.getAttribute("data-explorer-remove") ?? "{filter}";
  const filterFields = fieldsOf(root.getAttribute("data-filters"));
  const sortables = sortablesOf(root.getAttribute("data-sort"));
  const view = doc.defaultView ?? null;

  // The rows the page was rendered with, so clearing puts them back as they were.
  const original = body.innerHTML;

  let columns = columnsOf(root.getAttribute("data-columns"));
  let index: CollectionIndex | undefined;
  let prepared: PreparedRow[] | undefined;
  let facets: Facet[] = [];
  let matches: readonly IndexRow[] = [];
  let query = "";
  let sorting: { readonly field: string; readonly kind: string; readonly direction: SortDirection } | undefined;
  // Filters the address names before the index arrives and the facets exist.
  let pendingFilters = new Map<string, string[]>();
  let limit = ROW_LIMIT;
  let timer: unknown;
  let failed = false;
  // The rows on screen, and which of them the field names. `-1` is no active row.
  let drawn: ExplorerElement[] = [];
  let active = -1;

  /**
   * Makes the row at `index` the active one, or clears the mark when `index` has no row. The class is
   * what a reader sees, `aria-selected` what assistive tech reads, and `aria-activedescendant` the row
   * the field names; all three move together.
   */
  const markActive = (index: number): void => {
    const current = drawn[active];
    const next = drawn[index];
    if (current !== undefined && current !== next) {
      current.removeAttribute("class");
      current.removeAttribute("aria-selected");
    }
    if (next === undefined) {
      active = -1;
      // A reference to a row that is not there would dangle, so the attribute goes entirely.
      field.removeAttribute("aria-activedescendant");
      return;
    }
    active = index;
    next.setAttribute("class", ACTIVE_ROW_CLASS);
    next.setAttribute("aria-selected", "true");
    field.setAttribute("aria-activedescendant", optionId(index));
    next.scrollIntoView?.({ block: "nearest" });
  };

  const restore = (): void => {
    // The static rows are not options, so nothing stays active across the swap.
    markActive(-1);
    drawn = [];
    body.innerHTML = original;
    matches = [];
    limit = ROW_LIMIT;
    sorting = undefined;
    field.setAttribute("aria-expanded", "false");
    if (sortSelect !== null) sortSelect.value = "";
    if (table !== null) table.hidden = false;
    if (empty !== null) {
      empty.hidden = true;
      empty.textContent = "";
    }
    if (more !== null) more.hidden = true;
    if (chips !== null) {
      chips.replaceChildren();
      chips.hidden = true;
    }
    if (status !== null) status.textContent = "";
  };

  const drawRows = (): void => {
    // The rows are replaced, so the mark goes with them and the field names nothing until a key
    // moves it again.
    markActive(-1);
    drawn = matches
      .slice(0, limit)
      .map((row, at) => {
        const tr = rowOf(doc, row, columns, index as CollectionIndex, base, lang, noValue);
        tr.setAttribute("id", optionId(at));
        return tr;
      });
    body.replaceChildren(...drawn);
    // Expanded only while there is a list to move through: with no matches the table is hidden.
    field.setAttribute("aria-expanded", matches.length > 0 ? "true" : "false");
    if (table !== null) table.hidden = matches.length === 0;
    if (more !== null) more.hidden = matches.length <= limit;
  };

  const chosen = (facet: Facet): string[] =>
    facet.values.filter((value) => value.input.checked === true).map((value) => value.raw);

  const filtering = (): boolean => facets.some((facet) => chosen(facet).length > 0);

  const passes = (row: IndexRow, facet: Facet): boolean => {
    const values = chosen(facet);
    if (values.length === 0) return true;
    const at = index?.columns.indexOf(facet.field) ?? -1;
    return at < 0 || values.includes(cellText(row, at, facet.kind, lang));
  };

  /** The chosen sort, when the page offers the field and the direction names one. */
  const chooseSort = (field: string, direction: SortDirection | undefined): void => {
    const sortable = sortables.find((entry) => entry.field === field);
    if (sortable === undefined || direction === undefined) {
      sorting = undefined;
      if (sortSelect !== null) sortSelect.value = "";
      return;
    }
    sorting = { field: sortable.field, kind: sortable.kind, direction };
    if (sortSelect !== null) sortSelect.value = `${sortable.field}:${direction}`;
  };

  /** True while the table shows a result the address should keep. */
  const hasState = (): boolean => query.trim() !== "" || filtering() || sorting !== undefined;

  /**
   * Replaces this explorer's keys in the address, keeping every other parameter and the fragment.
   * The names are the search results contract's, so the no-script form and a shared link agree.
   */
  const write = (): void => {
    if (view === null) return;
    const url = new URL(view.location.href);
    for (const key of [...url.searchParams.keys()]) {
      if (key === QUERY_PARAM || key === SORT_PARAM || key === ORDER_PARAM || key.startsWith(FILTER_PARAM)) {
        url.searchParams.delete(key);
      }
    }
    const text = query.trim();
    if (text !== "") url.searchParams.set(QUERY_PARAM, text);
    for (const facet of facets) {
      for (const value of chosen(facet)) url.searchParams.append(`${FILTER_PARAM}${facet.field}`, value);
    }
    if (sorting !== undefined) {
      url.searchParams.set(SORT_PARAM, sorting.field);
      url.searchParams.set(ORDER_PARAM, sorting.direction === "descending" ? "desc" : "asc");
    }
    view.history.replaceState(null, "", url.toString());
  };

  /** Checks the boxes the address names, and no others. */
  const checkFilters = (saved: ReadonlyMap<string, readonly string[]>): void => {
    for (const facet of facets) {
      const values = saved.get(facet.field) ?? [];
      for (const value of facet.values) value.input.checked = values.includes(value.raw);
    }
  };

  const drawChips = (): void => {
    if (chips === null) return;
    const buttons: ExplorerElement[] = [];
    for (const facet of facets) {
      for (const value of facet.values) {
        if (value.input.checked !== true) continue;
        const text = `${facet.label}: ${value.raw}`;
        const button = doc.createElement("button");
        button.setAttribute("class", "data-explorer-chip");
        button.setAttribute("type", "button");
        button.setAttribute("aria-label", removePattern.replace("{filter}", text));
        button.textContent = `${text} ×`;
        button.addEventListener("click", () => {
          value.input.checked = false;
          run();
          // The chip is gone, so focus moves to the checkbox that replaced it rather than the body.
          value.input.focus?.();
        });
        buttons.push(button);
      }
    }
    chips.replaceChildren(...buttons);
    chips.hidden = buttons.length === 0;
  };

  // Every value says how many rows the query and the other fields leave; its own field is ignored,
  // so an unchosen value stays reachable.
  const updateCounts = (text: string): void => {
    if (prepared === undefined) return;
    const textRows = new Set(matchRows(prepared, text));
    for (const facet of facets) {
      const at = index?.columns.indexOf(facet.field) ?? -1;
      if (at < 0) continue;
      for (const value of facet.values) {
        let count = 0;
        for (const entry of prepared) {
          if (!textRows.has(entry.row)) continue;
          if (facets.some((other) => other !== facet && !passes(entry.row, other))) continue;
          if (cellText(entry.row, at, facet.kind, lang) === value.raw) count += 1;
        }
        value.count.textContent = `(${formatNumber(lang, count)})`;
      }
    }
  };

  const render = (text: string): void => {
    if (prepared === undefined) return;
    let selected = matchRows(prepared, text).filter((row) => facets.every((facet) => passes(row, facet)));
    const active = sorting;
    if (active !== undefined) {
      const at = index?.columns.indexOf(active.field) ?? -1;
      if (at >= 0) {
        selected = sortRows(selected, (row) => sortKey(row[at], active.kind), active.kind, active.direction, lang);
      }
    }
    matches = selected;
    limit = ROW_LIMIT;
    drawRows();
    if (status !== null) status.textContent = countText(root, lang, matches.length);
    if (empty !== null) {
      const none = matches.length === 0;
      empty.hidden = !none;
      empty.textContent = none ? (text === "" ? filterEmpty : emptyPattern.replace("{query}", text)) : "";
    }
    updateCounts(text);
    drawChips();
  };

  /** Offers relevance and both directions of every field named in `sort`, once the index is known. */
  const drawSort = (): void => {
    if (sortBox === null || sortSelect === null || sortables.length === 0) return;
    if (sortSelect.querySelector("option") !== null) return;

    const relevance = doc.createElement("option");
    relevance.setAttribute("value", "");
    relevance.textContent = root.getAttribute("data-explorer-relevance") ?? "";
    sortSelect.append(relevance);

    for (const sortable of sortables) {
      for (const direction of ["ascending", "descending"] as const) {
        const option = doc.createElement("option");
        option.setAttribute("value", `${sortable.field}:${direction}`);
        option.textContent = `${sortable.label} — ${root.getAttribute(`data-explorer-${direction}`) ?? direction}`;
        sortSelect.append(option);
      }
    }
    sortSelect.value = sorting === undefined ? "" : `${sorting.field}:${sorting.direction}`;
    sortSelect.addEventListener("change", () => {
      const [field = "", direction] = (sortSelect.value ?? "").split(":");
      chooseSort(
        field,
        direction === "descending" ? "descending" : direction === "ascending" ? "ascending" : undefined,
      );
      if (prepared !== undefined) {
        if (hasState()) render(query.trim());
        else restore();
      }
      write();
    });
    sortBox.hidden = false;
  };

  const loader = createIndexLoader(
    { field: field as unknown as IndexField, base, collection },
    { fetchText: env.fetchText },
    {
      ready(loaded) {
        index = loaded;
        if (columns.length === 0) columns = columnsOf(null, loaded);
        prepared = prepareRows(loaded, columns.map((column) => column.field));
        facets =
          filtersBox === null ? [] : buildFacets(root, doc, filtersBox, loaded, columns, filterFields, lang);
        if (filtersBox !== null) filtersBox.hidden = facets.length === 0;
        checkFilters(pendingFilters);
        pendingFilters = new Map();
        drawSort();
        if (hasState()) render(query.trim());
      },
      failed() {
        failed = true;
        if (status !== null) status.textContent = failedText;
      },
    },
  );

  /** Puts the address's query, filters and sort into the controls and the table. */
  const applyAddress = (): void => {
    const params = new URLSearchParams(view?.location.search ?? "");
    query = params.get(QUERY_PARAM) ?? "";
    field.value = query;

    const saved = new Map<string, string[]>();
    for (const [key, value] of params) {
      if (!key.startsWith(FILTER_PARAM)) continue;
      const name = key.slice(FILTER_PARAM.length);
      if (name === "" || name === "collection") continue;
      saved.set(name, [...(saved.get(name) ?? []), value]);
    }
    pendingFilters = saved;
    if (facets.length > 0) checkFilters(saved);
    const order = params.get(ORDER_PARAM);
    chooseSort(params.get(SORT_PARAM) ?? "", order === "asc" ? "ascending" : order === "desc" ? "descending" : undefined);

    if (prepared === undefined) {
      if (hasState()) void loader.load();
      return;
    }
    if (hasState()) render(query.trim());
    else restore();
  };

  function run(): void {
    timer = undefined;
    const text = query.trim();
    if (!hasState()) {
      restore();
    } else if (prepared !== undefined) {
      render(text);
    } else {
      if (status !== null) status.textContent = loadingText;
      if (failed) {
        failed = false;
        void loader.load();
      }
    }
    write();
  }

  /** Reads the field, resets the sort, and runs the query once typing rests. */
  const typed = (): void => {
    query = field.value ?? "";
    sorting = undefined;
    if (sortSelect !== null) sortSelect.value = "";
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
    if (query.trim() === "") {
      run();
      return;
    }
    timer = env.schedule(run, DEBOUNCE_MS);
  };

  field.addEventListener("input", typed);

  // The field owns the keys and the rows never take focus, so Tab keeps the page's own order. Only
  // ArrowDown, ArrowUp, Enter, and Escape are handled; anything else, Tab included, is the browser's.
  field.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (drawn.length === 0) return;
      event.preventDefault();
      markActive(
        event.key === "ArrowDown"
          ? active + 1 >= drawn.length
            ? 0
            : active + 1
          : active <= 0
            ? drawn.length - 1
            : active - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      // No drawn row keeps the form's own Enter, which submits to the search results page.
      const row = drawn[active >= 0 ? active : 0];
      const link = row?.querySelector("a");
      if (link === undefined || link === null) return;
      event.preventDefault();
      link.click?.();
      return;
    }

    if (event.key === "Escape") {
      // An empty field has nothing to clear, so the key is left to the browser.
      if ((field.value ?? "") === "") return;
      event.preventDefault();
      field.value = "";
      typed();
    }
  });

  filtersBox?.addEventListener("change", run);

  more?.addEventListener("click", () => {
    limit += ROW_LIMIT;
    drawRows();
  });

  // Back and forward restore the controls without writing the address again.
  view?.addEventListener("popstate", applyAddress);
  applyAddress();
}

/** Wires every explorer in the document; a page without one does nothing. */
export function activate(doc: ExplorerDocument, env: ExplorerEnv = browserEnv): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) attach(root, doc, env);
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: ExplorerDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
