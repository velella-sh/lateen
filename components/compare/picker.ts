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
import { calendarDate, type DateCalendar } from "../../src/dates.ts";
import { parseJson } from "../../src/guards.ts";
import { withParams } from "../../src/url.ts";
import type { CompareDocument, CompareElement, CompareEnv } from "./client.ts";
import {
  keyOf,
  labelOf,
  optionsOf,
  rowsOf,
  selectionOf,
  valueOf,
  type CompareField,
  type ComparedRow,
  type PickerColumn,
  type PickerSelection,
} from "./picker-model.ts";

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
const RECORD_SELECTOR = ".compare-record";
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

/** One record column: its header, its cells, and the picker the island draws in the header. */
interface ColumnState {
  readonly at: number;
  readonly head: CompareElement;
  readonly cells: readonly CompareElement[];
  readonly title: PickElement;
  readonly button: CompareElement;
  readonly panel: CompareElement;
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
  readonly calendar: DateCalendar | undefined;
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
  readonly fetchJson: (url: string, signal: AbortSignal) => Promise<unknown>;
  wanted: readonly string[];
  index?: CollectionIndex;
  selection?: PickerSelection;
  loader?: IndexLoader;
  retry?: () => void;
  write: () => void;
}

/** The address's chosen ids, one slot per column, with empty slots kept as empty strings. */
export function recordsOf(search: string): string[] {
  const text = new URLSearchParams(search).get(RECORDS_PARAM);
  return text === null ? [] : text.split(",").map((id) => id.trim());
}

/** The page query with the chosen ids set or removed, keeping every other parameter where it was. */
export function withRecords(search: string, ids: readonly string[]): string {
  return withParams(search, { [RECORDS_PARAM]: ids.every((id) => id === "") ? null : ids.join(",") });
}

/** A value as a picker cell shows it, in the page's language and calendar. */
function cellText(
  value: unknown,
  kind: string,
  state: Pick<CompareState, "lang" | "calendar" | "empty" | "yes" | "no">,
): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return state.empty;
  }
  if (kind === "date" && typeof value === "string") {
    return calendarDate(value, state.lang, state.calendar)?.text ?? value;
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

/** The fields a comparison renders, in row order, from the root's `data-fields`. */
function fieldsOf(text: string): CompareField[] {
  if (text === "") return [];
  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): CompareField[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const field = (entry as Record<string, unknown>).field;
    if (typeof field !== "string" || field === "") return [];
    const kind = (entry as Record<string, unknown>).kind;
    return [{ field, kind: typeof kind === "string" ? kind : "text" }];
  });
}

/** An attribute's text, or an empty string. */
function attrOf(element: CompareElement, name: string): string {
  return element.getAttribute(name)?.trim() ?? "";
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

/** Shows a selection: the panel's choice, its missing note, the changed columns, and every row's difference. */
function showSelection(
  state: CompareState,
  selection: PickerSelection,
  previous: PickerSelection | undefined,
): void {
  const index = state.index;
  if (index === undefined) return;
  state.selection = selection;
  state.columns.forEach((column, at) => {
    const chosen = selection.columns[at];
    if (chosen === undefined) return;
    if (chosen.missing === undefined) {
      if (column.missing !== undefined) column.missing.hidden = true;
    } else {
      showMissing(state, column, chosen.missing);
    }
    if (chosen.row !== undefined && chosen.row !== previous?.columns[at]?.row) applyRecord(state, column, chosen);
    if (chosen.id !== "" && column.select !== undefined) column.select.value = chosen.id;
  });
  renderRows(state, rowsOf(index, selection.columns, state.fields));
}

/** Fills every picker with one option per record, in the index's order, and the selection's choice. */
function populate(state: CompareState, selection: PickerSelection): void {
  const index = state.index;
  if (index === undefined) return;
  const doc = state.doc;
  const options = optionsOf(index);
  for (const column of state.columns) {
    const select = doc.createElement("select");
    select.setAttribute("class", SELECT_CLASS);
    select.setAttribute("aria-label", state.recordsLabel);
    for (const option of options) {
      const node = doc.createElement("option");
      node.setAttribute("value", option.id);
      node.textContent = option.label;
      select.appendChild(node);
    }
    const id = selection.columns[column.at]?.id ?? "";
    if (id !== "") select.value = id;
    select.addEventListener("change", () => choose(state, column));
    column.select = select;
    const missing = missingOf(state, column);
    missing.hidden = true;
    column.panel.replaceChildren(select, missing);
  }
}

/** The column's current record, found by its header link or, without one, by its title. */
function resolveCurrent(index: CollectionIndex, column: ColumnState): IndexRow | undefined {
  const link = column.head.querySelector("a");
  const href = link?.getAttribute("href") ?? "";
  if (href !== "") {
    const row = index.rows.find((candidate) => String(candidate[index.columns.length - 1] ?? "") === href);
    if (row !== undefined) return row;
  }
  const title = column.title.textContent?.trim() ?? "";
  const at = index.columns.indexOf("title");
  return at < 0 ? undefined : index.rows.find((candidate) => String(candidate[at] ?? "") === title);
}

/** Replaces the column's header title and cell labels, keeping the page's link to the record. */
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
  for (const cell of column.cells) {
    const label = cell.querySelector(RECORD_SELECTOR);
    if (label !== null) label.textContent = title;
  }
}

/** Marks one row as different or equal, adding its marker once. */
function showDiff(state: CompareState, rowElement: CompareElement, differs: boolean): void {
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
}

/** Renders every row's difference from the model, then updates the live count once. */
function renderRows(state: CompareState, rows: readonly ComparedRow[]): void {
  const rowElements = [...state.root.querySelectorAll(ROW_SELECTOR)];
  const toggle = state.root.querySelector(TOGGLE_SELECTOR);
  rowElements.forEach((rowElement, at) => {
    const row = rows[at];
    if (row === undefined || !row.available) return;
    showDiff(state, rowElement, row.differs);
    if (toggle?.checked === true) rowElement.hidden = !row.differs;
  });
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
function applyRecord(state: CompareState, column: ColumnState, chosen: PickerColumn): void {
  const index = state.index;
  const row = chosen.row;
  if (index === undefined || row === undefined) return;
  renameColumn(state, column, row);

  [...state.root.querySelectorAll(ROW_SELECTOR)].forEach((rowElement, at) => {
    const field = state.fields[at];
    const cell = rowElement.querySelector(`td[data-compare-column="${column.at}"]`);
    if (field === undefined || cell === null) return;
    const found = valueOf(index, row, field.field);
    const label = cell.querySelector(RECORD_SELECTOR);
    cell.textContent = found.found ? cellText(found.value, field.kind, state) : state.empty;
    if (label !== null) cell.prepend(label);
  });
}

/** Applies one picker choice, then writes every column's id to the address. */
function choose(state: CompareState, column: ColumnState): void {
  const index = state.index;
  const current = state.selection;
  if (index === undefined || current === undefined) return;
  const id = column.select?.value ?? "";
  const wanted = current.ids.map((one, at) => (at === column.at ? id : one));
  const next = selectionOf(index, wanted, current.columns.map((chosen) => chosen.row));
  showSelection(state, next, current);
  if (next.columns[column.at]?.missing !== undefined) return;
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
    { fetchJson: state.fetchJson },
    {
      ready: (index) => {
        state.index = index;
        const defaults = state.columns.map((column) => resolveCurrent(index, column));
        const selection = selectionOf(index, state.wanted, defaults);
        populate(state, selection);
        showSelection(state, selection, selectionOf(index, [], defaults));
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
          }, { signal: state.env.signal });
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
    if (state.selection !== undefined) populate(state, state.selection);
    return;
  }
  if (state.loader === undefined) showNote(state.doc, column, state.loading || "Loading records…");
  load(state);
}

/** One comparison's picker state, or undefined when its markup names no collection or fields. */
function stateOf(doc: PickDocument, root: CompareElement, env: CompareEnv): CompareState | undefined {
  const collection = attrOf(root, COLLECTION_ATTR);
  const fields = fieldsOf(root.getAttribute(FIELDS_ATTR) ?? "");
  const fetchJson = env.fetchJson;
  if (collection === "" || fields.length === 0 || fetchJson === undefined) return undefined;

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

  const calendar = attrOf(root, "data-calendar");
  return {
    root,
    doc,
    base: attrOf(root, BASE_ATTR),
    collection,
    fields,
    columns,
    lang: attrOf(root, LANG_ATTR) || "en",
    calendar: calendar === "jalali" || calendar === "gregorian" ? calendar : undefined,
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
    fetchJson,
    wanted: [],
    write: () => {},
  };
}

/**
 * Gives every comparison's record columns a picker. Nothing is fetched here; the first picker a
 * reader opens reads the index, and the address's chosen ids are applied once it arrives.
 */
export function attachPickers(doc: CompareDocument, env: CompareEnv): void {
  if (env.fetchJson === undefined) return;
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
      const ids = states.flatMap((one) => one.selection?.ids ?? one.columns.map(() => ""));
      env.replaceUrl(`${withRecords(env.search(), ids)}${env.hash()}`);
    };
    for (const column of state.columns) {
      column.button.addEventListener("click", () => toggle(state, column), { signal: env.signal });
    }
  }
}
