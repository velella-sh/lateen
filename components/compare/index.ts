import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { formatField } from "../../src/fields.ts";
import { selectRecords, type SelectedRecord } from "../../src/records.ts";
import { columnsOf } from "../record-table/index.ts";
import table from "../table/index.ts";

/** The Markdown directive this component handles: `::compare{from="books" ids="a,b" fields='[...]'}`. */
export const directive = "compare";

/** Class on the wrapper around the notes and the table. */
export const WRAPPER_CLASS = "compare";

/** Class on the note shown when the setup is missing or the collection is unknown. */
export const ERROR_CLASS = "compare-error";

/** Class on the note shown for an id the collection does not have. */
export const MISSING_CLASS = "compare-missing";

/** Class on one value cell. */
export const CELL_CLASS = "compare-cell";

/** Props from the directive or the page's front matter. */
export type CompareProps = {
  /** The collection to read. */
  from?: string;
  /** JSON array of record ids, or a comma list; the records render as columns in this order. */
  ids?: string | readonly string[];
  /** JSON array of `{ field, label, kind }`, or the array a page's front matter already holds. */
  fields?: string | readonly unknown[];
};

/** A JSON string as data, or undefined when it is not valid JSON. */
function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** The ids as written: a JSON array of strings, or a comma list. */
export function idsOf(value: unknown): string[] {
  const parsed = typeof value === "string" ? (value.trim().startsWith("[") ? parse(value) : value.split(",")) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((id) => {
    const text = typeof id === "string" ? id.trim() : "";
    return text === "" ? [] : [text];
  });
}

/**
 * Records of one collection side by side: the ids name the columns, in that order, and the fields
 * name the rows. Every cell goes through `formatField`, and each column header links to its record's
 * page. A missing setup or an unknown collection shows a note instead of a table; an id the
 * collection lacks shows a visible note, so a typo never drops a column silently.
 */
export default function compare({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as CompareProps;
  const lang = page?.lang ?? "en";
  const from = typeof input.from === "string" ? input.from.trim() : "";
  const ids = idsOf(input.ids);
  const fields = columnsOf(input.fields);

  if (from === "" || ids.length === 0 || fields.length === 0) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "compare_missing_setup"));
  }

  const selection = selectRecords(site, page, { collection: from });
  if (!selection.ok) {
    return h(
      "p",
      { class: ERROR_CLASS, role: "note" },
      t(lang, "compare_unknown_collection", { name: selection.error.name }),
    );
  }

  const byId = new Map(selection.records.map((record) => [record.id, record]));
  const records: SelectedRecord[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (record === undefined) missing.push(id);
    else records.push(record);
  }

  const notes = missing.map((id) =>
    h("p", { class: MISSING_CLASS, role: "note" }, t(lang, "compare_unknown_record", { name: id })),
  );
  if (records.length === 0) return h("div", { class: WRAPPER_CLASS }, notes);

  const head = h(
    "thead",
    null,
    h(
      "tr",
      null,
      h("td", null),
      records.map((record) => {
        const title = formatField(record.fields.title ?? record.id, "text", lang);
        return h(
          "th",
          { scope: "col" },
          record.url === undefined ? title : h("a", { href: record.url }, title as never),
        );
      }),
    ),
  );

  const body = h(
    "tbody",
    null,
    fields.map((field) =>
      h(
        "tr",
        null,
        h("th", { scope: "row" }, field.label ?? field.field),
        records.map((record) => {
          const value = field.field === "id" ? record.id : record.fields[field.field];
          return h(
            "td",
            { class: CELL_CLASS, "data-kind": field.kind ?? "text" },
            formatField(value, field.kind, lang, site?.config) as never,
          );
        }),
      ),
    ),
  );

  return h("div", { class: WRAPPER_CLASS }, notes, h(table, null, head, body));
}
