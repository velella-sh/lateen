/* Compare picker's pure side: which record each column shows, the address ids it could not find,
 * and how the chosen records differ field by field. Nothing here touches the document, so a
 * selection change can build the model once and the picker only renders it. */

import type { CollectionIndex, IndexRow } from "../data-explorer/index-loader.ts";

/** One row of the comparison: its field and how its values compare. */
export interface CompareField {
  readonly field: string;
  readonly kind: string;
}

/** One column's chosen record and the address id it could not find, if any. */
export interface PickerColumn {
  readonly id: string;
  readonly row: IndexRow | undefined;
  readonly missing: string | undefined;
}

/** Every column's choice, with the ids in column order, as the address writes them. */
export interface PickerSelection {
  readonly columns: readonly PickerColumn[];
  readonly ids: readonly string[];
}

/** One field's values across the columns, and whether they differ. `available` is false when a
 * column has no record or the index lacks the field, so the picker leaves that row as it was. */
export interface ComparedRow {
  readonly field: CompareField;
  readonly values: readonly unknown[];
  readonly differs: boolean;
  readonly available: boolean;
}

/** A field's value in an index row, or that the index does not carry the field. */
interface Found {
  readonly found: boolean;
  readonly value?: unknown;
}

/** The id the index gives a row: its `id` column, or its page URL when the index has no id column. */
export function keyOf(index: CollectionIndex, row: IndexRow): string {
  const at = index.columns.indexOf("id");
  return String(row[at < 0 ? index.columns.length - 1 : at] ?? "");
}

/** The row with that id, or undefined when the index does not list it. */
export function rowOf(index: CollectionIndex, id: string): IndexRow | undefined {
  return index.rows.find((row) => keyOf(index, row) === id);
}

/** The option text for a row: its title, or its id when the index has no title column. */
export function labelOf(index: CollectionIndex, row: IndexRow): string {
  const at = index.columns.indexOf("title");
  const title = at < 0 ? null : row[at];
  return title === null || title === undefined || title === "" ? keyOf(index, row) : String(title);
}

/** The value a field holds in a row. */
export function valueOf(index: CollectionIndex, row: IndexRow, field: string): Found {
  if (field === "id") return { found: true, value: keyOf(index, row) };
  const at = index.columns.indexOf(field);
  return at < 0 ? { found: false } : { found: true, value: row[at] };
}

/** One option per record, in the index's own order; the address never reorders this list. */
export function optionsOf(index: CollectionIndex): { id: string; label: string }[] {
  return index.rows.map((row) => ({ id: keyOf(index, row), label: labelOf(index, row) }));
}

/**
 * The address's ids applied to the columns by position. A column the address does not name keeps
 * its current record; a named id the index lacks keeps that record and reports the id as missing,
 * so a typo never drops a column silently.
 */
export function selectionOf(
  index: CollectionIndex,
  wanted: readonly string[],
  current: readonly (IndexRow | undefined)[],
): PickerSelection {
  const columns = current.map((row, at) => {
    const id = wanted[at] ?? "";
    const chosen = id === "" ? undefined : rowOf(index, id);
    const shown = chosen ?? row;
    return {
      id: shown === undefined ? "" : keyOf(index, shown),
      row: shown,
      missing: id !== "" && chosen === undefined ? id : undefined,
    };
  });
  return { columns, ids: columns.map((column) => column.id) };
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

/**
 * Every field's values across the chosen records, in column order, with its difference decided
 * once. A column without a record or a field the index lacks makes the row unavailable, so the
 * picker leaves that row's markup untouched.
 */
export function rowsOf(
  index: CollectionIndex,
  columns: readonly PickerColumn[],
  fields: readonly CompareField[],
): ComparedRow[] {
  return fields.map((field) => {
    const values: unknown[] = [];
    for (const column of columns) {
      if (column.row === undefined) return { field, values: [], differs: false, available: false };
      const found = valueOf(index, column.row, field.field);
      if (!found.found) return { field, values: [], differs: false, available: false };
      values.push(found.value);
    }
    return { field, values, differs: rowDiffers(values, field.kind), available: true };
  });
}
