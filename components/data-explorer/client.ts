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

/** The box that scrolls the table; hidden while an empty note shows. */
export const TABLE_SELECTOR = ".table-scroll";

/** The table body the island replaces. */
export const BODY_SELECTOR = "tbody";

/** The body row the island reads and writes. */
export const ROW_SELECTOR = "tbody tr";

/** How long typing rests before the query runs. */
export const DEBOUNCE_MS = 150;

/** Rows one page shows; the same number `index.ts` renders as the static table. */
export const ROW_LIMIT = 50;

/** The part of an element the island uses. */
export interface ExplorerElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: () => void): void;
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  append(child: ExplorerElement): void;
  replaceChildren(...children: ExplorerElement[]): void;
  textContent: string | null;
  innerHTML: string;
  hidden: boolean;
  value?: string;
  ownerDocument?: ExplorerDocument | null;
}

/** The part of the document the island uses. */
export interface ExplorerDocument {
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  createElement(tag: string): ExplorerElement;
  documentElement?: { getAttribute(name: string): string | null } | null;
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
          return [{ field: entry.field, kind: typeof entry.kind === "string" ? entry.kind : "text" }];
        });
        if (columns.length > 0) return columns;
      }
    } catch {
      // A malformed attribute falls through to the index's columns.
    }
  }
  return (index?.columns ?? []).filter((field) => field !== URL_COLUMN).map((field) => ({ field, kind: "text" }));
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

/** One row of the table, shaped like `record-table`'s: the first cell links to the record's page. */
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

  const base = root.getAttribute("data-base") ?? "";
  const collection = root.getAttribute("data-collection") ?? "";
  const lang = root.getAttribute("data-lang") ?? "en";
  const noValue = root.getAttribute("data-explorer-no-value") ?? "";
  const loadingText = root.getAttribute("data-explorer-loading") ?? "";
  const failedText = root.getAttribute("data-explorer-failed") ?? "";
  const emptyPattern = root.getAttribute("data-explorer-empty") ?? "";

  // The rows the page was rendered with, so clearing puts them back as they were.
  const original = body.innerHTML;

  let columns = columnsOf(root.getAttribute("data-columns"));
  let index: CollectionIndex | undefined;
  let prepared: PreparedRow[] | undefined;
  let matches: readonly IndexRow[] = [];
  let query = "";
  let limit = ROW_LIMIT;
  let timer: unknown;
  let failed = false;

  const restore = (): void => {
    body.innerHTML = original;
    matches = [];
    limit = ROW_LIMIT;
    if (table !== null) table.hidden = false;
    if (empty !== null) {
      empty.hidden = true;
      empty.textContent = "";
    }
    if (more !== null) more.hidden = true;
    if (status !== null) status.textContent = "";
  };

  const drawRows = (): void => {
    body.replaceChildren(
      ...matches
        .slice(0, limit)
        .map((row) => rowOf(doc, row, columns, index as CollectionIndex, base, lang, noValue)),
    );
    if (table !== null) table.hidden = matches.length === 0;
    if (more !== null) more.hidden = matches.length <= limit;
  };

  const render = (text: string): void => {
    if (prepared === undefined) return;
    matches = matchRows(prepared, text);
    limit = ROW_LIMIT;
    drawRows();
    if (status !== null) status.textContent = countText(root, lang, matches.length);
    if (empty !== null) {
      empty.hidden = matches.length > 0;
      empty.textContent = matches.length === 0 ? emptyPattern.replace("{query}", text) : "";
    }
  };

  const loader = createIndexLoader(
    { field: field as unknown as IndexField, base, collection },
    { fetchText: env.fetchText },
    {
      ready(loaded) {
        index = loaded;
        if (columns.length === 0) columns = columnsOf(null, loaded);
        prepared = prepareRows(loaded, columns.map((column) => column.field));
        const text = query.trim();
        if (text !== "") render(text);
      },
      failed() {
        failed = true;
        if (status !== null) status.textContent = failedText;
      },
    },
  );

  function run(): void {
    timer = undefined;
    const text = query.trim();
    if (text === "") {
      restore();
      return;
    }
    if (prepared !== undefined) {
      render(text);
      return;
    }
    if (status !== null) status.textContent = loadingText;
    if (failed) {
      failed = false;
      void loader.load();
    }
  }

  field.addEventListener("input", () => {
    query = field.value ?? "";
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
    if (query.trim() === "") {
      restore();
      return;
    }
    timer = env.schedule(run, DEBOUNCE_MS);
  });

  more?.addEventListener("click", () => {
    limit += ROW_LIMIT;
    drawRows();
  });
}

/** Wires every explorer in the document; a page without one does nothing. */
export function activate(doc: ExplorerDocument, env: ExplorerEnv = browserEnv): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) attach(root, doc, env);
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: ExplorerDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
