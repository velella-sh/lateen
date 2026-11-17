import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { formatField, kindOf, type FieldKind } from "../../src/fields.ts";
import { selectRecords, type SelectedRecord } from "../../src/records.ts";
import table from "../table/index.ts";

/** The Markdown directive this component handles: `::record-table{from="books" columns='[...]'}`. */
export const directive = "record-table";

/** Class on the error a table shows instead of rows. */
export const ERROR_CLASS = "record-table-error";

/** Class on a cell whose column names a field the records do not have. */
export const MISSING_CLASS = "record-table-missing";

/** One column of the table, as the page or the directive writes it. */
export interface RecordColumn {
  readonly field: string;
  readonly label?: string;
  readonly kind?: FieldKind;
}

/** Props from the directive or the page's front matter. */
export type RecordTableProps = {
  /** The collection to read; required. */
  from?: string;
  /** JSON array of `{ field, label, kind }`. */
  columns?: string;
  /** The table's caption, also its accessible name. */
  caption?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The columns as written: a JSON string, or the array a page's front matter already holds. */
export function columnsOf(value: unknown): RecordColumn[] {
  const parsed = typeof value === "string" ? parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.field !== "string" || entry.field.trim() === "") return [];
    return [
      {
        field: entry.field.trim(),
        ...(typeof entry.label === "string" && entry.label.trim() !== "" ? { label: entry.label.trim() } : {}),
        kind: kindOf(entry.kind),
      },
    ];
  });
}

/** A JSON string as data, or undefined when it is not valid JSON. */
function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** True when any record, or the id every record has, carries `field`. */
function known(field: string, records: readonly SelectedRecord[]): boolean {
  if (field === "id") return true;
  return records.some((record) => Object.hasOwn(record.fields, field));
}

/**
 * Records of one collection as a table. Every cell goes through `formatField`, and the first column
 * links to the record's page. An unknown collection shows a note instead of a table; an unknown field
 * shows a message inside its cells, so a typo is visible rather than silently empty.
 */
export default function recordTable({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as RecordTableProps;
  const from = typeof input.from === "string" ? input.from.trim() : "";
  const lang = page?.lang ?? "en";
  const columns = columnsOf(input.columns);
  const caption = typeof input.caption === "string" ? input.caption.trim() : "";

  if (from === "" || columns.length === 0) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "record_table_missing_setup"));
  }

  const selection = selectRecords(site, page, { collection: from });
  if (!selection.ok) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "record_table_unknown_collection", { name: selection.error.name }));
  }

  const head = h(
    "thead",
    null,
    h(
      "tr",
      null,
      columns.map((column) => h("th", { scope: "col" }, column.label ?? column.field)),
    ),
  );

  const body = h(
    "tbody",
    null,
    selection.records.map((record) =>
      h(
        "tr",
        null,
        columns.map((column, index) => {
          const cell = known(column.field, [record])
            ? formatField(
                column.field === "id" ? record.id : record.fields[column.field],
                column.kind,
                lang,
                site?.config,
              )
            : h("span", { class: MISSING_CLASS }, t(lang, "record_table_unknown_field", { name: column.field }));
          const content =
            index === 0 && record.url !== undefined ? h("a", { href: record.url }, cell as never) : cell;
          return h("td", { class: "record-table-cell", "data-kind": column.kind ?? "text" }, content as never);
        }),
      ),
    ),
  );

  return h(
    table,
    (caption === "" ? {} : { label: caption }) as never,
    [caption === "" ? null : h("caption", null, caption), head, body] as never,
  );
}
