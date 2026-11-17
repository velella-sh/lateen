import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { patternOf, t } from "../../i18n/index.ts";
import { formatField, isEmpty, kindOf, type FieldKind } from "../../src/fields.ts";
import { selectRecords, type SelectedRecord } from "../../src/records.ts";
import table from "../table/index.ts";

/** The Markdown directive this component handles: `::record-table{from="books" columns='[...]'}`. */
export const directive = "record-table";

/** Class on the error a table shows instead of rows. */
export const ERROR_CLASS = "record-table-error";

/** Class on a cell whose column names a field the records do not have. */
export const MISSING_CLASS = "record-table-missing";

/** Class on the wrapper that carries the sort messages; absent when nothing sorts. */
export const SORTABLE_CLASS = "record-table-sortable";

/** Class on a header's sort button. It starts `hidden`; `client.ts` reveals it. */
export const SORT_CLASS = "record-table-sort";

/** Class on the live region that announces the new order. */
export const STATUS_CLASS = "record-table-status";

/** Marks the wrapper the island finds with `data-record-table-sort`. */
export const SORT_ATTRIBUTE = "data-record-table-sort";

/** The kinds whose columns sort in the browser. */
export const SORTABLE_KINDS: readonly FieldKind[] = ["text", "number", "date"];

/** One column of the table, as the page or the directive writes it. */
export interface RecordColumn {
  readonly field: string;
  readonly label?: string;
  readonly kind?: FieldKind;
}

/** Props from the directive or the page's front matter. */
export type RecordTableProps = {
  /** The collection to read; required unless `records` already holds the rows. */
  from?: string;
  /** Ready rows from `LayoutProps.list.records`; the layout passes them so the table never re-selects. */
  records?: readonly SelectedRecord[];
  /** JSON array of `{ field, label, kind }`, or the array a page's front matter already holds. */
  columns?: string | readonly RecordColumn[];
  /** The table's caption, also its accessible name. */
  caption?: string;
  /** True when the document holds only this page's rows, so sorting them would mislead. */
  paginated?: boolean;
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
  const paginated = input.paginated === true;

  const ready = input.records;
  if ((from === "" && ready === undefined) || columns.length === 0) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "record_table_missing_setup"));
  }

  const selection = ready === undefined ? selectRecords(site, page, { collection: from }) : { ok: true as const, records: ready };
  if (!selection.ok) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "record_table_unknown_collection", { name: selection.error.name }));
  }

  // Only the columns whose values compare in the browser become a control. It stays `hidden` until
  // `client.ts` reveals it, so a visitor without a script gets no control that would do nothing.
  const sortable = (column: RecordColumn): boolean =>
    !paginated && SORTABLE_KINDS.includes(column.kind ?? "text");

  const head = h(
    "thead",
    null,
    h(
      "tr",
      null,
      columns.map((column) => {
        const label = column.label ?? column.field;
        return h(
          "th",
          {
            scope: "col",
            ...(sortable(column)
              ? { "data-field": column.field, "data-kind": column.kind ?? "text", "data-label": label }
              : {}),
          },
          label,
          sortable(column)
            ? h(
                "button",
                {
                  class: SORT_CLASS,
                  type: "button",
                  hidden: true,
                  "aria-label": t(lang, "record_table_sort", { column: label }),
                },
                "↕",
              )
            : null,
        );
      }),
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
          const value = column.field === "id" ? record.id : record.fields[column.field];
          const content =
            index === 0 && record.url !== undefined ? h("a", { href: record.url }, cell as never) : cell;
          return h(
            "td",
            {
              class: "record-table-cell",
              "data-kind": column.kind ?? "text",
              ...(known(column.field, [record]) && !isEmpty(value) ? { "data-value": String(value) } : {}),
            },
            content as never,
          );
        }),
      ),
    ),
  );

  const rendered = h(
    table,
    (caption === "" ? {} : { label: caption }) as never,
    [caption === "" ? null : h("caption", null, caption), head, body] as never,
  );
  if (!columns.some(sortable)) return rendered;

  // The island reads every word it announces from here, as the search dialog does.
  return h(
    "div",
    {
      class: SORTABLE_CLASS,
      [SORT_ATTRIBUTE]: true,
      "data-sort-ascending": patternOf(lang, "record_table_sorted_ascending"),
      "data-sort-descending": patternOf(lang, "record_table_sorted_descending"),
    },
    h("p", { class: STATUS_CLASS, role: "status" }),
    rendered,
  );
}
