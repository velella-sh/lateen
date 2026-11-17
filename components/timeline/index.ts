import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { formatField, isEmpty } from "../../src/fields.ts";
import { selectRecords } from "../../src/records.ts";
import table from "../table/index.ts";

/** The Markdown directive this component handles: `::timeline{from="events"}`. */
export const directive = "timeline";

/** Class on the note shown instead of a table. */
export const ERROR_CLASS = "timeline-error";

/** Class on a cell whose row has no field. */
export const MISSING_CLASS = "timeline-missing";

/** Class on a cell whose date is not ISO 8601. */
export const INVALID_CLASS = "timeline-invalid";

/** Props from the directive or the page's front matter. */
export type TimelineProps = {
  /** The collection to read; required unless `items` is given. */
  from?: string;
  /** JSON array of rows, each with the label, start, end and status fields. */
  items?: string;
  /** The field holding a row's label; defaults to `label`. */
  label?: string;
  /** The field holding a row's start date; defaults to `start`. */
  start?: string;
  /** The field holding a row's end date; defaults to `end`. */
  end?: string;
  /** The field holding a row's status; defaults to `status`. */
  status?: string;
  /** The table's caption, also its accessible name. */
  caption?: string;
};

/** One row's fields, and the URL of its page when the collection has one. */
interface Row {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly url?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** A JSON string as data, or undefined when it is not valid JSON. */
function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** A field name from the directive, or its default when absent or blank. */
function fieldName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Rows from a JSON array, or undefined when `items` is not an array of objects. */
function rowsOf(items: string): Row[] | undefined {
  const parsed = parse(items);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter(isRecord).map((fields) => ({ fields }));
}

/** A visible message for a field the row does not have. */
function missing(field: string, lang: string): ComponentChildren {
  return h("span", { class: MISSING_CLASS }, t(lang, "timeline_unknown_field", { name: field }));
}

/**
 * One cell. A date must be ISO 8601: a valid one renders as `<time>`, anything else shows a
 * message instead of silently reading as text. A field the row does not have is visible too.
 */
function cell(
  row: Row,
  field: string,
  kind: "date" | "status" | "text",
  lang: string,
  config: SiteConfig | undefined,
): ComponentChildren {
  if (!Object.hasOwn(row.fields, field)) return missing(field, lang);
  const value = row.fields[field];
  if (kind === "date" && !isEmpty(value)) {
    const date = typeof value === "string" ? calendarDate(value, lang) : undefined;
    if (date === undefined) {
      return h(
        "span",
        { class: INVALID_CLASS },
        t(lang, "timeline_invalid_date", { name: field, value: String(value) }),
      );
    }
    return h("time", { datetime: date.datetime }, date.text);
  }
  return formatField(value, kind, lang, config);
}

/**
 * Timeline rows as a readable table: label, start, end and status. Rows come from a collection
 * (`from`) or from a JSON `items` attribute. An unknown collection, a missing field and a date that
 * is not ISO 8601 each show a visible message, so a typo never renders an empty timeline.
 */
export default function timeline({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as TimelineProps;
  const lang = page?.lang ?? "en";
  const caption = typeof input.caption === "string" ? input.caption.trim() : "";
  const fields = {
    label: fieldName(input.label, "label"),
    start: fieldName(input.start, "start"),
    end: fieldName(input.end, "end"),
    status: fieldName(input.status, "status"),
  };

  const from = typeof input.from === "string" ? input.from.trim() : "";
  const items = typeof input.items === "string" ? input.items.trim() : "";
  let rows: Row[] | undefined;

  if (from !== "") {
    const selection = selectRecords(site, page, { collection: from });
    if (!selection.ok) {
      const key =
        selection.error.code === "unknown-collection" ? "timeline_unknown_collection" : "timeline_unknown_field";
      return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, key, { name: selection.error.name }));
    }
    rows = selection.records.map((record) => ({
      fields: record.fields,
      ...(record.url === undefined ? {} : { url: record.url }),
    }));
  } else if (items !== "") {
    rows = rowsOf(items);
  }

  if (rows === undefined) {
    return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, "timeline_missing_setup"));
  }

  const config = site?.config;
  const head = h(
    "thead",
    null,
    h(
      "tr",
      null,
      [t(lang, "timeline_label"), t(lang, "timeline_start"), t(lang, "timeline_end"), t(lang, "timeline_status")].map(
        (label) => h("th", { scope: "col" }, label),
      ),
    ),
  );

  const body = h(
    "tbody",
    null,
    rows.map((row) => {
      const label = cell(row, fields.label, "text", lang, config);
      return h(
        "tr",
        null,
        h(
          "td",
          { class: "timeline-cell", "data-field": "label" },
          row.url === undefined ? label : h("a", { href: row.url }, label as never),
        ),
        h("td", { class: "timeline-cell", "data-field": "start" }, cell(row, fields.start, "date", lang, config)),
        h("td", { class: "timeline-cell", "data-field": "end" }, cell(row, fields.end, "date", lang, config)),
        h("td", { class: "timeline-cell", "data-field": "status" }, cell(row, fields.status, "status", lang, config)),
      );
    }),
  );

  return h(
    table,
    (caption === "" ? {} : { label: caption }) as never,
    [caption === "" ? null : h("caption", null, caption), head, body] as never,
  );
}
