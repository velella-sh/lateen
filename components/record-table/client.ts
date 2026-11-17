/* Table sorting and filtering: the header buttons `index.ts` writes hidden are revealed and wired
 * here, so the page without a script shows a plain table and no control that would do nothing.
 * Sorting reads the raw value the cell carries in `data-value`, never the formatted text, so a number
 * and a date compare as numbers and dates in every language. Empty values stay last in both
 * directions, and equal values keep the order the server sent. Filtering reads the rows already in
 * the page: the text matches any visible cell, and each select matches the raw value of its column. */

/** The wrapper around a table the island may sort. */
export const WRAPPER_SELECTOR = "[data-record-table-sort]";

/** A header's sort button. */
export const BUTTON_SELECTOR = ".record-table-sort";

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

/** A sort direction, as `aria-sort` spells it. */
export type SortDirection = "ascending" | "descending";

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
}

/** A comparable cell value: a number for number and date columns, text otherwise, absent when empty. */
export type SortKey = number | string | undefined;

/** The raw value of one cell, or undefined when the cell is empty or does not parse as its kind. */
export function keyOf(row: SortElement, index: number, kind: string): SortKey {
  const cell = [...row.querySelectorAll(CELL_SELECTOR)][index];
  const raw = cell?.getAttribute("data-value") ?? "";
  if (raw === "") return undefined;
  if (kind === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  if (kind === "date") {
    const value = Date.parse(raw);
    return Number.isNaN(value) ? undefined : value;
  }
  return raw;
}

/** Two values in ascending order. Empty values come last, and text uses the page language's collation. */
export function compareKeys(a: SortKey, b: SortKey, kind: string, lang: string): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (kind === "number" || kind === "date") return (a as number) - (b as number);
  return new Intl.Collator(lang, { sensitivity: "variant" }).compare(String(a), String(b));
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
  return rows
    .map((row, at) => ({ row, at, key: keyOf(row, index, kind) }))
    .sort((x, y) => {
      const order = compareKeys(x.key, y.key, kind, lang);
      if (order === 0 || x.key === undefined || y.key === undefined) return order === 0 ? x.at - y.at : order;
      return direction === "descending" ? -order : order;
    })
    .map((entry) => entry.row);
}

/** The column a header names, so the announcement says which column the reader sorted by. */
function labelOf(th: SortElement): string {
  return th.getAttribute("data-label") ?? "";
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

/** Reveals the filter form, hides the rows that do not match, and announces how many remain. */
function attachFilters(
  wrapper: SortElement,
  body: SortElement,
  lang: string,
  status: SortElement | null,
): void {
  const form = wrapper.querySelector(FILTERS_SELECTOR);
  if (form === null) return;
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
  text?.addEventListener("input", apply);
  for (const select of selects) select.addEventListener("change", apply);
  clear?.addEventListener("click", () => {
    if (text !== null) text.value = "";
    for (const select of selects) select.value = "";
    apply();
  });
}

/** Reveals and wires every sort button and filter control under `wrapper`. */
function attach(wrapper: SortElement, lang: string): void {
  const table = wrapper.querySelector("table");
  const body = table?.querySelector("tbody") ?? null;
  if (table === null || body === null) return;
  const headers = [...(table.querySelector("thead tr")?.querySelectorAll("th") ?? [])];
  const status = wrapper.querySelector(STATUS_SELECTOR);
  attachFilters(wrapper, body, lang, status);
  for (const button of wrapper.querySelectorAll(BUTTON_SELECTOR)) {
    const th = button.closest("th");
    if (th === null) continue;
    const index = headers.indexOf(th);
    const field = th.getAttribute("data-field");
    const kind = th.getAttribute("data-kind") ?? "text";
    const label = labelOf(th);
    if (index === -1 || field === null || label === "") continue;
    button.hidden = false;
    button.addEventListener("click", () => {
      const direction: SortDirection =
        th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      for (const header of headers) header.removeAttribute("aria-sort");
      th.setAttribute("aria-sort", direction);
      const rows = [...body.querySelectorAll(ROW_SELECTOR)];
      for (const row of orderRows(rows, index, kind, direction, lang)) body.append(row);
      const pattern =
        direction === "ascending"
          ? wrapper.getAttribute("data-sort-ascending") ?? ""
          : wrapper.getAttribute("data-sort-descending") ?? "";
      if (status !== null) status.textContent = pattern.replace("{column}", label);
    });
  }
}

/** Wires every sortable table in the document; a page without one does nothing. */
export function activate(doc: SortDocument): void {
  const lang = doc.documentElement?.getAttribute("lang") ?? "en";
  for (const wrapper of doc.querySelectorAll(WRAPPER_SELECTOR)) attach(wrapper, lang);
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: SortDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
