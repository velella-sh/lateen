/* Compare's record picker: one changer per record column, listing the collection's records from its
 * index file. Opening a picker is the first moment the index is read, so a page never pays for it on
 * load. Choosing a record replaces that column's header and cells and recomputes which rows differ.
 * The chosen ids live in the address as `?records=a,b`; a saved link restores them when the first
 * picker opens, the first moment the records are known. */

import {
  createIndexLoader,
  type CollectionIndex,
  type IndexLoader,
  type IndexRow,
} from "../data-explorer/index-loader.ts";
import { calendarDate } from "../../src/dates.ts";
import type { CompareDocument, CompareElement, CompareEnv } from "./client.ts";

/** Class on the button that opens a column's records. */
export const PICK_CLASS = "compare-pick";

/** Class on the panel a picker opens. */
export const PICKER_CLASS = "compare-picker";

/** Class on the note for an id the address names and the collection lacks. */
export const PICKER_MISSING_CLASS = "compare-picker-missing";

/** Class on a picker's loading or failure text. */
export const PICKER_STATUS_CLASS = "compare-picker-status";

/** The query parameter holding the chosen record ids, in column order. */
export const RECORDS_PARAM = "records";

const ROOT_SELECTOR = "[data-compare]";
const HEAD_SELECTOR = "thead th[data-compare-column]";
const ROW_SELECTOR = "[data-compare-row]";
const TAB_SELECTOR = ".compare-tab";
const TOGGLE_SELECTOR = ".compare-only-diff";
const STATUS_SELECTOR = ".compare-status";

const DIFF_ATTR = "data-diff";
const DIFF_CLASS = "compare-diff";
const DIFF_MARKER_CLASS = "compare-diff-marker";
const TITLE_CLASS = "compare-title";
const SELECT_CLASS = "compare-picker-select";

const COLLECTION_ATTR = "data-collection";
const BASE_ATTR = "data-base";
const LANG_ATTR = "data-lang";
const FIELDS_ATTR = "data-fields";
const PICK_LABEL_ATTR = "data-compare-pick";
const LOADING_ATTR = "data-compare-loading";
const FAILED_ATTR = "data-compare-failed";
const RETRY_ATTR = "data-compare-retry";
const DIFFERS_ATTR = "data-compare-marker";
const UNKNOWN_ATTR = "data-compare-unknown";
const EMPTY_ATTR = "data-compare-empty";
const TRUE_ATTR = "data-compare-true";
const FALSE_ATTR = "data-compare-false";
const RECORDS_ATTR = "data-compare-records";

/** The part of an element the picker needs beyond {@link CompareElement}: moving the title out. */
interface PickElement extends CompareElement {
  readonly firstChild: PickElement | null;
  appendChild(child: PickElement): void;
  value?: string;
}

/** The part of the document the picker needs. */
interface PickDocument {
  createElement(tag: string): PickElement;
}

/** One row of the comparison: its field and how its values compare. */
interface CompareField {
  readonly field: string;
  readonly kind: string;
}

/** One record column: its header, its cells, and the picker the island draws in the header. */
interface ColumnState {
  readonly at: number;
  readonly head: CompareElement;
  readonly cells: readonly CompareElement[];
  readonly title: PickElement;
  readonly button: CompareElement;
  readonly panel: CompareElement;
  id?: string;
  row?: IndexRow;
  select?: PickElement;
  missing?: PickElement;
}

/** One comparison and everything its pickers share: the index, the address choice, and its words. */
interface CompareState {
  readonly root: CompareElement;
  readonly doc: PickDocument;
  readonly base: string;
  readonly collection: string;
  readonly fields: readonly CompareField[];
  readonly columns: readonly ColumnState[];
  readonly lang: string;
  readonly pickLabel: string;
  readonly loading: string;
  readonly failed: string;
  readonly retryLabel: string;
  readonly differs: string;
  readonly unknown: string;
  readonly empty: string;
  readonly yes: string;
  readonly no: string;
  readonly recordsLabel: string;
  readonly env: CompareEnv;
  readonly fetchText: (url: string, signal: AbortSignal) => Promise<string>;
  wanted: readonly string[];
  index?: CollectionIndex;
  loader?: IndexLoader;
  retry?: () => void;
  write: () => void;
}

/** A field's value in an index row, or that the index does not carry the field. */
interface Found {
  readonly found: boolean;
  readonly value?: unknown;
}

/** The address's chosen ids, one slot per column, with empty slots kept as empty strings. */
export function recordsOf(search: string): string[] {
  const text = new URLSearchParams(search).get(RECORDS_PARAM);
  return text === null ? [] : text.split(",").map((id) => id.trim());
}

/** The page query with the chosen ids set or removed, keeping every other parameter where it was. */
export function withRecords(search: string, ids: readonly string[]): string {
  const params = new URLSearchParams(search);
  if (ids.every((id) => id === "")) params.delete(RECORDS_PARAM);
  else params.set(RECORDS_PARAM, ids.join(","));
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

/** A value as a picker cell shows it, in the page's language and calendar. */
function cellText(
  value: unknown,
  kind: string,
  state: Pick<CompareState, "lang" | "empty" | "yes" | "no">,
): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return state.empty;
  }
  if (kind === "date" && typeof value === "string") {
    return calendarDate(value, state.lang)?.text ?? value;
  }
  if (kind === "number") {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    return Number.isFinite(number) ? new Intl.NumberFormat(state.lang).format(number) : String(value);
  }
  if (kind === "boolean") {
    const flag = typeof value === "string" ? value.trim().toLowerCase() : value;
    if (flag === true || flag === "true") return state.yes;
    if (flag === false || flag === "false") return state.no;
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

/** A raw value as comparison text: a number by value, a list without its order, anything else as JSON. */
function comparable(value: unknown, kind: string): string {
  const one = (item: unknown): string => {
    if (kind === "number" && (typeof item === "number" || typeof item === "string")) {
      const number = Number(item);
      if (Number.isFinite(number)) return `n:${number}`;
    }
    return `${typeof item}:${typeof item === "object" ? JSON.stringify(item) : String(item)}`;
  };
  return kind === "list" && Array.isArray(value)
    ? `l:${value.map(one).sort().join("\u0000")}`
    : one(value);
}

/** True when the values are not all equal; a missing value differs from every present value. */
function rowDiffers(values: readonly unknown[], kind: string): boolean {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
  );
  if (present.length === 0) return false;
  if (present.length !== values.length) return true;
  const first = comparable(present[0], kind);
  return present.some((value) => comparable(value, kind) !== first);
}

/** Shortcut: the comparison rules mirror `index.ts`; move both into one module when a third caller needs them. */

/** The fields a comparison renders, in row order, from the root's `data-fields`. */
function fieldsOf(text: string): CompareField[] {
  if (text === "") return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): CompareField[] => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
      const field = (entry as Record<string, unknown>).field;
      if (typeof field !== "string" || field === "") return [];
      const kind = (entry as Record<string, unknown>).kind;
      return [{ field, kind: typeof kind === "string" ? kind : "text" }];
    });
  } catch {
    return [];
  }
}

/** An attribute's text, or an empty string. */
function attrOf(element: CompareElement, name: string): string {
  return element.getAttribute(name)?.trim() ?? "";
}

/** The id the index gives a row: its `id` column, or its page URL when the index has no id column. */
function keyOf(index: CollectionIndex, row: IndexRow): string {
  const at = index.columns.indexOf("id");
  return String(row[at < 0 ? index.columns.length - 1 : at] ?? "");
}

/** The row with that id, or undefined when the index does not list it. */
function rowOf(index: CollectionIndex, id: string): IndexRow | undefined {
  return index.rows.find((row) => keyOf(index, row) === id);
}

/** The option text for a row: its title, or its id when the index has no title column. */
function labelOf(index: CollectionIndex, row: IndexRow): string {
  const at = index.columns.indexOf("title");
  const title = at < 0 ? null : row[at];
  return title === null || title === undefined || title === "" ? keyOf(index, row) : String(title);
}

/** The value a field holds in a row. */
function valueOf(index: CollectionIndex, row: IndexRow, field: string): Found {
  if (field === "id") return { found: true, value: keyOf(index, row) };
  const at = index.columns.indexOf(field);
  return at < 0 ? { found: false } : { found: true, value: row[at] };
}

/** A note the picker shows while loading, when loading fails, or for an id the address names. */
function noteOf(doc: PickDocument, className: string): PickElement {
  const note = doc.createElement("p");
  note.setAttribute("class", className);
  note.setAttribute("role", "note");
  return note;
}

/** The picker's empty missing note, so a column keeps one note across loads and choices. */
function missingOf(state: CompareState, column: ColumnState): PickElement {
  if (column.missing !== undefined) return column.missing;
  const note = noteOf(state.doc, PICKER_MISSING_CLASS);
  note.hidden = true;
  column.missing = note;
  return note;
}

/** Shows a message in a column's panel, replacing its select and keeping it visible. */
function showNote(doc: PickDocument, column: ColumnState, text: string, retry?: CompareElement): void {
  const note = noteOf(doc, PICKER_STATUS_CLASS);
  note.textContent = text;
  column.panel.replaceChildren(retry === undefined ? note : note, ...(retry === undefined ? [] : [retry]));
}

/** Names the id the address asked for but the collection does not list. */
function showMissing(state: CompareState, column: ColumnState, id: string): void {
  const note = missingOf(state, column);
  note.textContent = state.unknown.replace(/\{name\}/g, id);
  note.hidden = false;
  if (column.select !== undefined && !column.panel.querySelector("select")) {
    column.panel.replaceChildren(column.select, note);
  }
}

/** Applies the address's choice to every column it names, once the index is known. */
function applyWanted(state: CompareState): void {
  const index = state.index;
  if (index === undefined) return;
  state.columns.forEach((column, at) => {
    const id = state.wanted[at];
    if (id === undefined || id === "") return;
    const row = rowOf(index, id);
    if (row === undefined) {
      showMissing(state, column, id);
      return;
    }
    if (keyOf(index, row) !== column.id) applyRecord(state, column, row);
    column.missing?.setAttribute("hidden", "");
    if (column.select !== undefined && column.id !== undefined) column.select.value = column.id;
  });
}

/** Fills every picker with one option per record, keeping the column's current choice. */
function populate(state: CompareState): void {
  const index = state.index;
  if (index === undefined) return;
  const doc = state.doc;
  for (const column of state.columns) {
    if (column.row === undefined) resolveCurrent(state, column);
    const select = doc.createElement("select");
    select.setAttribute("class", SELECT_CLASS);
    select.setAttribute("aria-label", state.recordsLabel);
    for (const row of index.rows) {
      const option = doc.createElement("option");
      option.setAttribute("value", keyOf(index, row));
      option.textContent = labelOf(index, row);
      select.appendChild(option);
    }
    if (column.id !== undefined) select.value = column.id;
    select.addEventListener("change", () => choose(state, column));
    column.select = select;
    const missing = missingOf(state, column);
    missing.hidden = true;
    column.panel.replaceChildren(select, missing);
  }
}

/** The column's current record, found by its header link or, without one, by its title. */
function resolveCurrent(state: CompareState, column: ColumnState): void {
  const index = state.index;
  if (index === undefined) return;
  const link = column.head.querySelector("a");
  const href = link?.getAttribute("href") ?? "";
  if (href !== "") {
    const row = index.rows.find((candidate) => String(candidate[index.columns.length - 1] ?? "") === href);
    if (row !== undefined) {
      column.row = row;
      column.id = keyOf(index, row);
      return;
    }
  }
  const title = column.title.textContent?.trim() ?? "";
  const at = index.columns.indexOf("title");
  const row = at < 0 ? undefined : index.rows.find((candidate) => String(candidate[at] ?? "") === title);
  if (row !== undefined) {
    column.row = row;
    column.id = keyOf(index, row);
  }
}

/** Replaces the column's header title, keeping the page's link to the record. */
function renameColumn(state: CompareState, column: ColumnState, row: IndexRow): void {
  const index = state.index;
  if (index === undefined) return;
  const title = labelOf(index, row);
  const url = String(row[index.columns.length - 1] ?? "");
  if (url === "") {
    column.title.textContent = title;
  } else {
    const link = state.doc.createElement("a");
    link.setAttribute("href", url);
    link.textContent = title;
    column.title.replaceChildren(link);
  }
  const tabs = [...state.root.querySelectorAll(TAB_SELECTOR)];
  const tab = tabs[column.at];
  if (tab !== undefined) tab.textContent = title;
}

/** Recomputes one row's difference from every column's chosen record, and updates the visible state. */
function recomputeRow(state: CompareState, rowElement: CompareElement, field: CompareField): void {
  const index = state.index;
  if (index === undefined) return;
  const values: unknown[] = [];
  for (const column of state.columns) {
    if (column.row === undefined) return;
    const found = valueOf(index, column.row, field.field);
    if (!found.found) return;
    values.push(found.value);
  }

  const differs = rowDiffers(values, field.kind);
  const marker = rowElement.querySelector(`.${DIFF_MARKER_CLASS}`);
  if (differs) {
    rowElement.setAttribute(DIFF_ATTR, "");
    rowElement.setAttribute("class", DIFF_CLASS);
    if (marker === null) {
      const head = rowElement.querySelector("th[scope='row']");
      if (head !== null) {
        const span = state.doc.createElement("span");
        span.setAttribute("class", DIFF_MARKER_CLASS);
        span.textContent = ` ${state.differs || "Differs"}`;
        head.append(span);
      }
    } else {
      marker.hidden = false;
    }
  } else {
    rowElement.removeAttribute(DIFF_ATTR);
    rowElement.removeAttribute("class");
    if (marker !== null) marker.hidden = true;
  }

  const toggle = state.root.querySelector(TOGGLE_SELECTOR);
  if (toggle?.checked === true) rowElement.hidden = !differs;
  updateStatus(state);
}

/** Keeps the live region's count true after a choice shows or hides a row. */
function updateStatus(state: CompareState): void {
  const status = state.root.querySelector(STATUS_SELECTOR);
  if (status === null) return;
  const rows = [...state.root.querySelectorAll(ROW_SELECTOR)];
  const shown = rows.filter((row) => !row.hidden).length;
  const template = status.getAttribute("data-template") ?? "";
  const text = template.trim() === "" ? "{count} of {total} rows shown" : template;
  status.textContent = text.replace(/\{count\}/g, String(shown)).replace(/\{total\}/g, String(rows.length));
}

/** Replaces the column's cells with the chosen record's values. */
function applyRecord(state: CompareState, column: ColumnState, row: IndexRow): void {
  const index = state.index;
  if (index === undefined) return;
  column.row = row;
  column.id = keyOf(index, row);
  renameColumn(state, column, row);

  [...state.root.querySelectorAll(ROW_SELECTOR)].forEach((rowElement, at) => {
    const field = state.fields[at];
    const cell = rowElement.querySelector(`td[data-compare-column="${column.at}"]`);
    if (field === undefined || cell === null) return;
    const found = valueOf(index, row, field.field);
    cell.textContent = found.found ? cellText(found.value, field.kind, state) : state.empty;
  });

  [...state.root.querySelectorAll(ROW_SELECTOR)].forEach((rowElement, at) => {
    const field = state.fields[at];
    if (field !== undefined) recomputeRow(state, rowElement, field);
  });
}

/** Applies one picker choice, then writes every column's id to the address. */
function choose(state: CompareState, column: ColumnState): void {
  const index = state.index;
  if (index === undefined) return;
  const id = column.select?.value ?? "";
  const row = rowOf(index, id);
  if (row === undefined) {
    showMissing(state, column, id);
    return;
  }
  applyRecord(state, column, row);
  const missing = column.missing;
  if (missing !== undefined) missing.hidden = true;
  state.write();
  column.button.focus?.();
}

/** Starts the index load the first time a picker opens. */
function load(state: CompareState): void {
  if (state.loader !== undefined) return;
  state.loader = createIndexLoader(
    {
      field: { addEventListener: () => {}, ownerDocument: null },
      base: state.base,
      collection: state.collection,
    },
    { fetchText: state.fetchText },
    {
      ready: (index) => {
        state.index = index;
        for (const column of state.columns) if (column.row === undefined) resolveCurrent(state, column);
        populate(state);
        applyWanted(state);
      },
      failed: (retry) => {
        state.retry = retry;
        for (const column of state.columns) {
          const button = state.doc.createElement("button");
          button.setAttribute("type", "button");
          button.setAttribute("class", PICK_CLASS);
          button.textContent = state.retryLabel || "Try again";
          button.addEventListener("click", () => {
            showNote(state.doc, column, state.loading || "Loading records…");
            retry();
          });
          showNote(state.doc, column, state.failed || "Could not load the records.", button);
        }
      },
    },
  );
  void state.loader.load();
}

/** Opens or closes one column's picker, loading the index the first time it opens. */
function toggle(state: CompareState, column: ColumnState): void {
  const opening = column.panel.hidden;
  column.panel.hidden = !opening;
  column.button.setAttribute("aria-expanded", opening ? "true" : "false");
  if (!opening) return;
  if (state.index !== undefined) {
    populate(state);
    return;
  }
  if (state.loader === undefined) showNote(state.doc, column, state.loading || "Loading records…");
  load(state);
}

/** One comparison's picker state, or undefined when its markup names no collection or fields. */
function stateOf(doc: PickDocument, root: CompareElement, env: CompareEnv): CompareState | undefined {
  const collection = attrOf(root, COLLECTION_ATTR);
  const fields = fieldsOf(root.getAttribute(FIELDS_ATTR) ?? "");
  const fetchText = env.fetchText;
  if (collection === "" || fields.length === 0 || fetchText === undefined) return undefined;

  const columns: ColumnState[] = [...root.querySelectorAll(HEAD_SELECTOR)].map((head, at) => {
    const title = doc.createElement("span");
    title.setAttribute("class", TITLE_CLASS);
    const headElement = head as PickElement;
    while (headElement.firstChild !== null) title.appendChild(headElement.firstChild);

    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("class", PICK_CLASS);
    button.setAttribute("aria-expanded", "false");
    button.textContent = attrOf(root, PICK_LABEL_ATTR) || "Change record";

    const panel = doc.createElement("div");
    panel.setAttribute("class", PICKER_CLASS);
    panel.setAttribute("role", "group");
    panel.hidden = true;

    head.append(title, button, panel);
    return {
      at,
      head,
      cells: [...root.querySelectorAll(`td[data-compare-column="${at}"]`)],
      title,
      button,
      panel,
    };
  });

  return {
    root,
    doc,
    base: attrOf(root, BASE_ATTR),
    collection,
    fields,
    columns,
    lang: attrOf(root, LANG_ATTR) || "en",
    pickLabel: attrOf(root, PICK_LABEL_ATTR),
    loading: attrOf(root, LOADING_ATTR),
    failed: attrOf(root, FAILED_ATTR),
    retryLabel: attrOf(root, RETRY_ATTR),
    differs: attrOf(root, DIFFERS_ATTR),
    unknown: attrOf(root, UNKNOWN_ATTR),
    empty: attrOf(root, EMPTY_ATTR),
    yes: attrOf(root, TRUE_ATTR),
    no: attrOf(root, FALSE_ATTR),
    recordsLabel: attrOf(root, RECORDS_ATTR),
    env,
    fetchText,
    wanted: [],
    write: () => {},
  };
}

/**
 * Gives every comparison's record columns a picker. Nothing is fetched here; the first picker a
 * reader opens reads the index, and the address's chosen ids are applied once it arrives.
 */
export function attachPickers(doc: CompareDocument, env: CompareEnv): void {
  if (env.fetchText === undefined) return;
  const pickDoc = doc as unknown as PickDocument;
  const states = [...doc.querySelectorAll(ROOT_SELECTOR)].flatMap((root) => {
    const state = stateOf(pickDoc, root, env);
    return state === undefined ? [] : [state];
  });
  if (states.length === 0) return;

  let at = 0;
  for (const state of states) {
    state.wanted = recordsOf(env.search()).slice(at, at + state.columns.length);
    at += state.columns.length;
  }

  for (const state of states) {
    state.write = () => {
      const ids: string[] = [];
      for (const one of states) for (const column of one.columns) ids.push(column.id ?? "");
      env.replaceUrl(`${withRecords(env.search(), ids)}${env.hash()}`);
    };
    for (const column of state.columns) {
      column.button.addEventListener("click", () => toggle(state, column));
    }
  }
}
