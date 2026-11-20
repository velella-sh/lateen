/* Table sorting and filtering: the header buttons `index.ts` writes hidden are revealed and wired
 * here, so the page without a script shows a plain table and no control that would do nothing.
 * Sorting reads the raw value the cell carries in `data-value`, never the formatted text, so a number
 * and a date compare as numbers and dates in every language. Empty values stay last in both
 * directions, and equal values keep the order the server sent. Filtering reads the rows already in
 * the page: the text matches any visible cell, and each select matches the raw value of its column.
 * The chosen sort and filters live in the query string, so a shared link opens the same view; the
 * address is replaced, never pushed, and a page with several tables prefixes each table's keys. */

import { compareKeys, sortKey, sortRows, type SortDirection, type SortKey } from "../../src/sort.ts";

export { compareKeys, type SortDirection, type SortKey };

/** The wrapper around a table the island may sort. */
export const WRAPPER_SELECTOR = "[data-record-table-sort]";

/** A header's sort button. */
export const BUTTON_SELECTOR = ".record-table-sort";

/** The arrow inside a sort button, which shows the direction the column runs. */
export const INDICATOR_SELECTOR = ".record-table-sort-icon";

/** The live region that announces the new order. */
export const STATUS_SELECTOR = ".record-table-status";

/** One cell of a sortable column. */
export const CELL_SELECTOR = "td.record-table-cell";

/** A row of the table body. */
export const ROW_SELECTOR = "tr";

/** The filter form above a table. */
export const FILTERS_SELECTOR = ".record-table-filters";

/** The text filter, which matches any visible cell. */
export const TEXT_FILTER_SELECTOR = ".record-table-filter-text";

/** A select of one column's values; `data-column` is the cell index it reads. */
export const SELECT_FILTER_SELECTOR = ".record-table-filter-select";

/** The note shown when no row matches. */
export const EMPTY_FILTERS_SELECTOR = ".record-table-empty";

/** The button that clears every filter. */
export const CLEAR_FILTERS_SELECTOR = ".record-table-clear";

/** The part of an element the island uses. */
export interface SortElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: "click" | "input" | "change", listener: () => void): void;
  querySelector(selector: string): SortElement | null;
  querySelectorAll(selector: string): Iterable<SortElement>;
  closest(selector: string): SortElement | null;
  append(node: SortElement): void;
  hidden: boolean;
  value?: string;
  textContent: string | null;
}

/** The part of the document the island uses. */
export interface SortDocument {
  querySelectorAll(selector: string): Iterable<SortElement>;
  documentElement?: { getAttribute(name: string): string | null } | null;
  defaultView?: SortWindow | null;
}

/** The page address, read without reloading it. */
export interface SortLocation {
  href: string;
  search: string;
}

/** The page history, written without adding an entry. */
export interface SortHistory {
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/** The part of the window the island uses to keep the address in step. */
export interface SortWindow {
  location: SortLocation;
  history: SortHistory;
  addEventListener(type: "popstate", listener: () => void): void;
}

/** The raw value of one cell, or undefined when the cell is empty or does not parse as its kind. */
export function keyOf(row: SortElement, index: number, kind: string): SortKey {
  const cell = [...row.querySelectorAll(CELL_SELECTOR)][index];
  return sortKey(cell?.getAttribute("data-value") ?? "", kind);
}

/**
 * The rows in their new order. Empty values stay last whichever way the column runs, and equal values
 * keep the order they came in, so two clicks never shuffle rows the reader was reading.
 */
export function orderRows(
  rows: readonly SortElement[],
  index: number,
  kind: string,
  direction: SortDirection,
  lang: string,
): SortElement[] {
  return sortRows(rows, (row) => keyOf(row, index, kind), kind, direction, lang);
}

/** The column a header names, so the announcement says which column the reader sorted by. */
function labelOf(th: SortElement): string {
  return th.getAttribute("data-label") ?? "";
}

/** How a column sorts: unsorted, or one of the two directions `aria-sort` spells. */
type SortState = "none" | SortDirection;

/** The arrow that shows a header's state: the same glyphs in every direction of the page. */
const ARROWS: Readonly<Record<SortState, string>> = { none: "↕", ascending: "↑", descending: "↓" };

/** Marks a header's sort state for assistive technology, and the arrow beside its label. */
function mark(th: SortElement, state: SortState): void {
  th.setAttribute("aria-sort", state);
  const arrow = th.querySelector(INDICATOR_SELECTOR);
  if (arrow !== null) arrow.textContent = ARROWS[state];
}

/** A chosen select: the cell index it reads, and the value it keeps or "" for every value. */
interface Choice {
  readonly index: number;
  readonly value: string;
}

/** True when the row's text holds `words` and every chosen select keeps its cell's raw value. */
function matches(row: SortElement, words: string, choices: readonly Choice[], lang: string): boolean {
  const cells = [...row.querySelectorAll(CELL_SELECTOR)];
  if (words !== "" && !cells.some((cell) => (cell.textContent ?? "").toLocaleLowerCase(lang).includes(words))) {
    return false;
  }
  return choices.every(
    (choice) => choice.value === "" || cells[choice.index]?.getAttribute("data-value") === choice.value,
  );
}

/** The filter controls, and the function that puts saved values back into them. */
interface FilterView {
  readonly text: SortElement | null;
  readonly selects: readonly SortElement[];
  restore(params: URLSearchParams): void;
}

/** The direction `asc` or `desc` names; anything else was not written by a table. */
function directionOf(raw: string): SortDirection | undefined {
  return raw === "asc" ? "ascending" : raw === "desc" ? "descending" : undefined;
}

/** Replaces this table's keys in the address, keeping every other parameter and the fragment. */
function writeSearch(view: SortWindow, prefix: string, values: readonly (readonly [string, string])[]): void {
  const url = new URL(view.location.href);
  for (const key of [...url.searchParams.keys()]) {
    if (key === `${prefix}sort` || key === `${prefix}q` || key.startsWith(`${prefix}filter.`)) {
      url.searchParams.delete(key);
    }
  }
  for (const [name, value] of values) url.searchParams.set(prefix + name, value);
  view.history.replaceState(null, "", url.toString());
}

/** Reveals the filter form, hides the rows that do not match, and announces how many remain. */
function attachFilters(
  wrapper: SortElement,
  body: SortElement,
  lang: string,
  status: SortElement | null,
  prefix: string,
  onChange: () => void,
): FilterView | null {
  const form = wrapper.querySelector(FILTERS_SELECTOR);
  if (form === null) return null;
  const text = form.querySelector(TEXT_FILTER_SELECTOR);
  const selects = [...form.querySelectorAll(SELECT_FILTER_SELECTOR)];
  const empty = wrapper.querySelector(EMPTY_FILTERS_SELECTOR);
  const clear = empty?.querySelector(CLEAR_FILTERS_SELECTOR) ?? null;
  const pattern = wrapper.getAttribute("data-filter-count") ?? "";
  const format = new Intl.NumberFormat(lang);

  const apply = (): void => {
    const words = (text?.value ?? "").trim().toLocaleLowerCase(lang);
    const choices = selects.map((select) => ({
      index: Number(select.getAttribute("data-column")),
      value: select.value ?? "",
    }));
    const rows = [...body.querySelectorAll(ROW_SELECTOR)];
    let shown = 0;
    for (const row of rows) {
      const visible = matches(row, words, choices, lang);
      row.hidden = !visible;
      if (visible) shown += 1;
    }
    const active = words !== "" || choices.some((choice) => choice.value !== "");
    if (empty !== null) empty.hidden = shown > 0 || !active;
    if (status !== null) {
      status.textContent = pattern
        .replace("{count}", format.format(shown))
        .replace("{total}", format.format(rows.length));
    }
  };

  form.hidden = false;
  text?.addEventListener("input", () => {
    apply();
    onChange();
  });
  for (const select of selects) {
    select.addEventListener("change", () => {
      apply();
      onChange();
    });
  }
  clear?.addEventListener("click", () => {
    if (text !== null) text.value = "";
    for (const select of selects) select.value = "";
    apply();
    onChange();
  });
  return {
    text,
    selects,
    restore: (params) => {
      if (text !== null) text.value = params.get(`${prefix}q`) ?? "";
      for (const select of selects) {
        select.value = params.get(`${prefix}filter.${select.getAttribute("data-column")}`) ?? "";
      }
      apply();
    },
  };
}

/** Reveals and wires every sort button and filter control under `wrapper`; returns the restore. */
function attach(wrapper: SortElement, lang: string, view: SortWindow | null, prefix: string): () => void {
  const table = wrapper.querySelector("table");
  const body = table?.querySelector("tbody") ?? null;
  if (table === null || body === null) return () => {};
  const headers = [...(table.querySelector("thead tr")?.querySelectorAll("th") ?? [])];
  const sent = [...body.querySelectorAll(ROW_SELECTOR)];
  const sortable = new Map<string, { th: SortElement; index: number; kind: string }>();
  const status = wrapper.querySelector(STATUS_SELECTOR);

  const sortBy = (th: SortElement, index: number, kind: string, direction: SortDirection): void => {
    for (const entry of sortable.values()) mark(entry.th, "none");
    mark(th, direction);
    for (const row of orderRows([...body.querySelectorAll(ROW_SELECTOR)], index, kind, direction, lang)) {
      body.append(row);
    }
  };

  let filters: FilterView | null = null;
  const write = (): void => {
    if (view === null) return;
    const values: [string, string][] = [];
    const sorted = headers.find((header) => {
      const state = header.getAttribute("aria-sort");
      return state === "ascending" || state === "descending";
    });
    const field = sorted?.getAttribute("data-field") ?? null;
    if (sorted !== undefined && field !== null) {
      values.push(["sort", `${field}:${sorted.getAttribute("aria-sort") === "descending" ? "desc" : "asc"}`]);
    }
    const words = filters?.text?.value?.trim() ?? "";
    if (words !== "") values.push(["q", words]);
    for (const select of filters?.selects ?? []) {
      const value = select.value ?? "";
      if (value !== "") values.push([`filter.${select.getAttribute("data-column")}`, value]);
    }
    writeSearch(view, prefix, values);
  };

  filters = attachFilters(wrapper, body, lang, status, prefix, write);
  for (const button of wrapper.querySelectorAll(BUTTON_SELECTOR)) {
    const th = button.closest("th");
    if (th === null) continue;
    const index = headers.indexOf(th);
    const field = th.getAttribute("data-field");
    const kind = th.getAttribute("data-kind") ?? "text";
    const label = labelOf(th);
    if (index === -1 || field === null || label === "") continue;
    sortable.set(field, { th, index, kind });
    button.hidden = false;
    button.addEventListener("click", () => {
      const direction: SortDirection =
        th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      sortBy(th, index, kind, direction);
      const pattern =
        direction === "ascending"
          ? wrapper.getAttribute("data-sort-ascending") ?? ""
          : wrapper.getAttribute("data-sort-descending") ?? "";
      if (status !== null) status.textContent = pattern.replace("{column}", label);
      write();
    });
  }

  return () => {
    const params = new URLSearchParams(view?.location.search ?? "");
    const raw = params.get(`${prefix}sort`) ?? "";
    const colon = raw.lastIndexOf(":");
    const target = colon === -1 ? undefined : sortable.get(raw.slice(0, colon));
    const direction = directionOf(raw.slice(colon + 1));
    if (target !== undefined && direction !== undefined) {
      sortBy(target.th, target.index, target.kind, direction);
    } else {
      for (const entry of sortable.values()) mark(entry.th, "none");
      for (const row of sent) body.append(row);
    }
    filters?.restore(params);
  };
}

/** Wires every sortable table in the document; a page without one does nothing. */
export function activate(doc: SortDocument): void {
  const lang = doc.documentElement?.getAttribute("lang") ?? "en";
  const view = doc.defaultView ?? null;
  const wrappers = [...doc.querySelectorAll(WRAPPER_SELECTOR)];
  const restores = wrappers.map((wrapper, at) =>
    attach(wrapper, lang, view, wrappers.length > 1 ? `t${at + 1}.` : ""),
  );
  for (const restore of restores) restore();
  view?.addEventListener("popstate", () => {
    for (const restore of restores) restore();
  });
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: SortDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
