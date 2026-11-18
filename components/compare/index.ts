import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { patternOf, t } from "../../i18n/index.ts";
import { formatField, isEmpty, kindOf } from "../../src/fields.ts";
import { selectRecords, type SelectedRecord } from "../../src/records.ts";
import { baseOf } from "../../src/url.ts";
import { columnsOf } from "../record-table/index.ts";
import table from "../table/index.ts";

/** The Markdown directive this component handles: `::compare{from="books" ids="a,b" fields='[...]'}`. */
export const directive = "compare";

/** The directive attributes the comparison reads. */
export const OPTIONS = ["from", "ids", "fields"] as const;

/** Class on the wrapper around the notes and the table. */
export const WRAPPER_CLASS = "compare";

/** Class on the note shown when the setup is missing or the collection is unknown. */
export const ERROR_CLASS = "compare-error";

/** Class on the note shown for an id the collection does not have. */
export const MISSING_CLASS = "compare-missing";

/** Class on one value cell. */
export const CELL_CLASS = "compare-cell";

/** Class on a row whose raw values are not all equal. */
export const DIFF_CLASS = "compare-diff";

/** Class on the screen-reader text naming a row that differs. */
export const DIFF_MARKER_CLASS = "compare-diff-marker";

/** Marks the wrapper the island finds with `data-compare`. */
export const ROOT_ATTRIBUTE = "data-compare";

/** Class on the row of controls; it starts `hidden`, and `client.ts` reveals it. */
export const CONTROLS_CLASS = "compare-controls";

/** Class on the checkbox that hides the rows without a difference. */
export const TOGGLE_CLASS = "compare-only-diff";

/** Class on the live region announcing how many rows show. */
export const STATUS_CLASS = "compare-status";

/** Class on the button that copies the comparison as a Markdown table; it starts `hidden`. */
export const COPY_CLASS = "compare-copy";

/** Class on the live region announcing the copy's result. */
export const COPY_STATUS_CLASS = "compare-copy-status";

/** Class on the row of record tabs the island draws in a narrow container. */
export const TABS_CLASS = "compare-tabs";

/** Class on one record tab. */
export const TAB_CLASS = "compare-tab";

/** Attribute on a record's header and cells, holding the record's column number. */
export const COLUMN_ATTRIBUTE = "data-compare-column";

/** Marks the tab row the island fills with `ROOT_ATTRIBUTE` on the wrapper. */
export const TABS_ATTRIBUTE = "data-compare-tabs";

/**
 * A raw value as text for comparison: a number by value, so `1.0` and `1.00` are equal; a list
 * without its order; anything else as JSON.
 */
function comparable(value: unknown, kind: unknown): string {
  const one = (item: unknown): string => {
    if (kindOf(kind) === "number" && (typeof item === "number" || typeof item === "string")) {
      const number = Number(item);
      if (Number.isFinite(number)) return `n:${number}`;
    }
    return `${typeof item}:${typeof item === "object" ? JSON.stringify(item) : String(item)}`;
  };
  return kindOf(kind) === "list" && Array.isArray(value)
    ? `l:${value.map(one).sort().join("\u0000")}`
    : one(value);
}

/** True when a row's values are not all equal; a missing value differs from every present value. */
function rowDiffers(values: readonly unknown[], kind: unknown): boolean {
  const present = values.filter((value) => !isEmpty(value));
  if (present.length === 0) return false;
  if (present.length !== values.length) return true;
  const first = comparable(present[0], kind);
  return present.some((value) => comparable(value, kind) !== first);
}

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
      records.map((record, at) => {
        const title = formatField(record.fields.title ?? record.id, "text", lang);
        return h(
          "th",
          { scope: "col", [COLUMN_ATTRIBUTE]: String(at) },
          record.url === undefined ? title : h("a", { href: record.url }, title as never),
        );
      }),
    ),
  );

  const body = h(
    "tbody",
    null,
    fields.map((field) => {
      const values = records.map((record) =>
        field.field === "id" ? record.id : record.fields[field.field],
      );
      const differs = rowDiffers(values, field.kind);
      return h(
        "tr",
        {
          "data-compare-row": "",
          ...(differs ? { class: DIFF_CLASS, "data-diff": "" } : {}),
        },
        h(
          "th",
          { scope: "row" },
          field.label ?? field.field,
          differs ? h("span", { class: DIFF_MARKER_CLASS }, ` ${t(lang, "compare_differs")}`) : null,
        ),
        records.map((record, index) =>
          h(
            "td",
            { class: CELL_CLASS, "data-kind": field.kind ?? "text", [COLUMN_ATTRIBUTE]: String(index) },
            formatField(values[index], field.kind, lang, site?.config) as never,
          ),
        ),
      );
    }),
  );

  return h(
    "div",
    {
      class: WRAPPER_CLASS,
      [ROOT_ATTRIBUTE]: "",
      "data-base": baseOf(site),
      "data-collection": from,
      "data-lang": lang,
      "data-fields": JSON.stringify(fields.map(({ field, kind }) => ({ field, kind }))),
          "data-compare-pick": t(lang, "compare_change_record"),
      "data-compare-loading": t(lang, "compare_loading"),
      "data-compare-failed": t(lang, "compare_load_failed"),
      "data-compare-retry": t(lang, "compare_retry"),
      "data-compare-marker": t(lang, "compare_differs"),
      "data-compare-unknown": patternOf(lang, "compare_unknown_record"),
      "data-compare-empty": t(lang, "field_empty"),
      "data-compare-true": t(lang, "field_true"),
      "data-compare-false": t(lang, "field_false"),
      "data-compare-records": t(lang, "compare_records"),
    },
    notes,
    h(
      "div",
      {
        class: CONTROLS_CLASS,
        hidden: true,
        "data-compare-controls": "",
      },
      h(
        "label",
        { class: "compare-toggle" },
        h("input", { type: "checkbox", class: TOGGLE_CLASS, "data-compare-only-diff": "" }),
        " ",
        t(lang, "compare_show_only_diff"),
      ),
      h(
        "p",
        {
          class: STATUS_CLASS,
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true",
          "data-template": patternOf(lang, "compare_rows_shown"),
        },
        t(lang, "compare_rows_shown", { count: fields.length, total: fields.length }),
      ),
      h(
        "button",
        { type: "button", class: COPY_CLASS, "data-compare-copy": "", hidden: true },
        t(lang, "compare_copy"),
      ),
      h("span", {
        class: COPY_STATUS_CLASS,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      }),
    ),
    h(
      "div",
      {
        class: TABS_CLASS,
        role: "tablist",
        "aria-label": t(lang, "compare_records"),
        [TABS_ATTRIBUTE]: "",
        hidden: true,
      },
    ),
    h(table, null, head, body),
  );
}
